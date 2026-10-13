import os
import sys
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("train_models")

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.ml.dataset import generate_synthetic_transactions, split_dataset
from app.ml.classifier import train_and_evaluate_models
from app.ml.anomaly import train_isolation_forest


def main():
    logger.info("Step 1: Generating synthetic transaction dataset...")
    df = generate_synthetic_transactions(n_samples=6000, random_seed=42, output_path="artifacts/data/synthetic_transactions.csv")
    logger.info("Dataset shape: %s with high-risk distribution:\n%s", df.shape, df["is_high_risk"].value_counts(normalize=True))

    logger.info("Step 2: Splitting dataset into train, val, test splits...")
    train_df, val_df, test_df = split_dataset(df, test_size=0.15, val_size=0.15, random_state=42)
    logger.info("Train: %d, Val: %d, Test: %d", len(train_df), len(val_df), len(test_df))

    logger.info("Step 3: Training and evaluating Supervised Classifiers (Logistic Regression vs Random Forest)...")
    classifier_meta = train_and_evaluate_models(train_df, val_df, test_df, output_dir="artifacts/models")
    logger.info("Classifier evaluation completed. Selected model: %s", classifier_meta["selected_architecture"])

    logger.info("Step 4: Training Isolation Forest unsupervised anomaly detector...")
    anomaly_meta = train_isolation_forest(train_df, contamination=0.08, output_dir="artifacts/models")
    logger.info("Isolation Forest fitted successfully. Contamination: %s", anomaly_meta["contamination"])

    logger.info("All model artifacts saved in 'artifacts/models/'.")


if __name__ == "__main__":
    main()
