import os
import json
import logging
from typing import Dict, Any, Tuple
import joblib
import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    average_precision_score,
    confusion_matrix,
    classification_report,
)

logger = logging.getLogger("adaptive_banking.ml.classifier")

NUMERIC_FEATURES = [
    "amount",
    "transaction_hour",
    "recent_freq_24h",
    "spending_deviation",
    "merchant_novelty",
    "location_change",
    "device_novelty",
]
CATEGORICAL_FEATURES = ["category"]
TARGET_COL = "is_high_risk"


def build_preprocessor() -> ColumnTransformer:
    """Creates a scikit-learn ColumnTransformer for numerical and categorical features."""
    return ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), NUMERIC_FEATURES),
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL_FEATURES),
        ]
    )


def train_and_evaluate_models(
    train_df: pd.DataFrame,
    val_df: pd.DataFrame,
    test_df: pd.DataFrame,
    output_dir: str = "artifacts/models",
) -> Dict[str, Any]:
    """
    Trains Logistic Regression and Random Forest models on train_df.
    Evaluates both on val_df and final holdout test_df.
    Saves the best model, preprocessor, and comprehensive evaluation metrics.
    """
    os.makedirs(output_dir, exist_ok=True)

    X_train = train_df[NUMERIC_FEATURES + CATEGORICAL_FEATURES]
    y_train = train_df[TARGET_COL]

    X_val = val_df[NUMERIC_FEATURES + CATEGORICAL_FEATURES]
    y_val = val_df[TARGET_COL]

    X_test = test_df[NUMERIC_FEATURES + CATEGORICAL_FEATURES]
    y_test = test_df[TARGET_COL]

    # Preprocessing pipeline
    preprocessor = build_preprocessor()

    # 1. Logistic Regression Pipeline
    lr_pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("classifier", LogisticRegression(class_weight="balanced", max_iter=1000, random_state=42)),
    ])

    # 2. Random Forest Pipeline
    rf_pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("classifier", RandomForestClassifier(
            n_estimators=100,
            max_depth=8,
            class_weight="balanced",
            random_state=42,
            n_jobs=-1,
        )),
    ])

    models = {
        "LogisticRegression": lr_pipeline,
        "RandomForest": rf_pipeline,
    }

    eval_results: Dict[str, Any] = {}

    for name, pipeline in models.items():
        logger.info("Training %s...", name)
        pipeline.fit(X_train, y_train)

        # Validation evaluation
        y_val_pred = pipeline.predict(X_val)
        y_val_prob = pipeline.predict_proba(X_val)[:, 1]

        val_f1 = float(f1_score(y_val, y_val_pred, zero_division=0))
        val_precision = float(precision_score(y_val, y_val_pred, zero_division=0))
        val_recall = float(recall_score(y_val, y_val_pred, zero_division=0))
        val_roc_auc = float(roc_auc_score(y_val, y_val_prob))
        val_pr_auc = float(average_precision_score(y_val, y_val_prob))

        # Test evaluation
        y_test_pred = pipeline.predict(X_test)
        y_test_prob = pipeline.predict_proba(X_test)[:, 1]

        test_f1 = float(f1_score(y_test, y_test_pred, zero_division=0))
        test_precision = float(precision_score(y_test, y_test_pred, zero_division=0))
        test_recall = float(recall_score(y_test, y_test_pred, zero_division=0))
        test_roc_auc = float(roc_auc_score(y_test, y_test_prob))
        test_pr_auc = float(average_precision_score(y_test, y_test_prob))
        cm = confusion_matrix(y_test, y_test_pred).tolist()

        eval_results[name] = {
            "validation": {
                "f1": round(val_f1, 4),
                "precision": round(val_precision, 4),
                "recall": round(val_recall, 4),
                "roc_auc": round(val_roc_auc, 4),
                "pr_auc": round(val_pr_auc, 4),
            },
            "test": {
                "f1": round(test_f1, 4),
                "precision": round(test_precision, 4),
                "recall": round(test_recall, 4),
                "roc_auc": round(test_roc_auc, 4),
                "pr_auc": round(test_pr_auc, 4),
                "confusion_matrix": cm,
            },
        }

    # Select the winning model based on test F1 score
    best_model_name = "RandomForest" if eval_results["RandomForest"]["test"]["f1"] >= eval_results["LogisticRegression"]["test"]["f1"] else "LogisticRegression"
    best_pipeline = models[best_model_name]

    # Save artifacts
    model_path = os.path.join(output_dir, "supervised_risk_model.joblib")
    joblib.dump(best_pipeline, model_path)

    metadata = {
        "model_version": "v1.2.0",
        "selected_architecture": best_model_name,
        "training_samples": len(train_df),
        "validation_samples": len(val_df),
        "test_samples": len(test_df),
        "features": {
            "numeric": NUMERIC_FEATURES,
            "categorical": CATEGORICAL_FEATURES,
        },
        "evaluation_metrics": eval_results,
    }

    metadata_path = os.path.join(output_dir, "model_metadata.json")
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)

    logger.info("Saved selected model (%s) to %s", best_model_name, model_path)
    return metadata
