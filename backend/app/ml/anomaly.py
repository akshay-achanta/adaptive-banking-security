import os
import json
import logging
from typing import Dict, Any, Tuple
import joblib
import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.ensemble import IsolationForest
from app.ml.classifier import build_preprocessor, NUMERIC_FEATURES, CATEGORICAL_FEATURES

logger = logging.getLogger("adaptive_banking.ml.anomaly")


def train_isolation_forest(
    train_df: pd.DataFrame,
    contamination: float = 0.08,
    output_dir: str = "artifacts/models",
) -> Dict[str, Any]:
    """
    Trains an Isolation Forest unsupervised anomaly detector on historical transactions.
    
    IMPORTANT LIMITATIONS NOTICE:
    - Anomaly detection identifies statistical outliers and unusual transaction patterns,
      NOT confirmed fraud. Legitimate high-net-worth purchases or international travel
      will naturally present as statistical anomalies.
    - Anomaly scores must be reviewed as flags warranting secondary verification (MFA/challenge),
      never as autonomous conclusive proof of malicious intent.
    """
    os.makedirs(output_dir, exist_ok=True)

    X_train = train_df[NUMERIC_FEATURES + CATEGORICAL_FEATURES]

    preprocessor = build_preprocessor()

    iso_forest = IsolationForest(
        n_estimators=120,
        contamination=contamination,
        random_state=42,
        n_jobs=-1,
    )

    pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("anomaly_detector", iso_forest),
    ])

    logger.info("Fitting Isolation Forest with contamination=%f on %d samples...", contamination, len(train_df))
    pipeline.fit(X_train)

    model_path = os.path.join(output_dir, "isolation_forest.joblib")
    joblib.dump(pipeline, model_path)

    metadata = {
        "model_version": "v1.2.0-unsupervised",
        "algorithm": "IsolationForest",
        "contamination": contamination,
        "n_estimators": 120,
        "training_samples": len(train_df),
        "limitations_notice": "Statistical deviation does not equate to verified fraudulent intent.",
    }

    metadata_path = os.path.join(output_dir, "anomaly_metadata.json")
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)

    logger.info("Saved Isolation Forest model to %s", model_path)
    return metadata
