"""001_initial_schema

Revision ID: 001
Revises: None
Create Date: 2026-09-30 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create datasets table
    op.create_table(
        'datasets',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('label', sa.String(), nullable=False),
        sa.Column('source_type', sa.String(), nullable=True),
        sa.Column('file_type', sa.String(), nullable=True),
        sa.Column('row_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('valid_rows', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('duplicate_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    # 2. Create transactions table
    op.create_table(
        'transactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('dataset_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('datasets.id', ondelete='CASCADE'), nullable=False),
        sa.Column('txid', sa.String(), nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.Column('src_ip', sa.String(), nullable=True),
        sa.Column('dst_ip', sa.String(), nullable=True),
        sa.Column('src_port', sa.Integer(), nullable=True),
        sa.Column('dst_port', sa.Integer(), nullable=True),
        sa.Column('input_addresses', sa.JSON(), nullable=False),
        sa.Column('output_addresses', sa.JSON(), nullable=False),
        sa.Column('input_amounts', sa.JSON(), nullable=False),
        sa.Column('output_amounts', sa.JSON(), nullable=False),
        sa.Column('fee', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('script_type', sa.String(), nullable=True),
        sa.Column('geo_country', sa.String(), nullable=True),
        sa.Column('asn', sa.String(), nullable=True),
        sa.Column('city', sa.String(), nullable=True),
        sa.Column('lat', sa.Float(), nullable=True),
        sa.Column('lon', sa.Float(), nullable=True),
        sa.Column('ground_truth_label', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('dataset_id', 'txid', name='uq_dataset_txid'),
    )
    op.create_index('ix_transactions_txid', 'transactions', ['txid'])
    op.create_index('ix_transactions_dataset_id', 'transactions', ['dataset_id'])

    # 3. Create alerts table
    op.create_table(
        'alerts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('dataset_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('datasets.id', ondelete='CASCADE'), nullable=True),
        sa.Column('wallet_id', sa.String(), nullable=False),
        sa.Column('risk_score', sa.Float(), nullable=False),
        sa.Column('risk_level', sa.String(), nullable=False),
        sa.Column('model_source', sa.String(), nullable=False),
        sa.Column('if_score', sa.Float(), nullable=True),
        sa.Column('ae_score', sa.Float(), nullable=True),
        sa.Column('mixing_score', sa.Float(), nullable=True),
        sa.Column('xgb_score', sa.Float(), nullable=True),
        sa.Column('top_reasons', sa.JSON(), nullable=False),
        sa.Column('shap_values', sa.JSON(), nullable=False),
        sa.Column('evidence_txids', sa.JSON(), nullable=False),
        sa.Column('text_explanation', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='new'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_alerts_risk_score', 'alerts', ['risk_score'])
    op.create_index('ix_alerts_wallet_id', 'alerts', ['wallet_id'])
    op.create_index('ix_alerts_status', 'alerts', ['status'])
    op.create_index('ix_alerts_dataset_id', 'alerts', ['dataset_id'])

    # 4. Create model_runs table
    op.create_table(
        'model_runs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('model_name', sa.String(), nullable=False),
        sa.Column('dataset_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('datasets.id', ondelete='SET NULL'), nullable=True),
        sa.Column('task_id', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='queued'),
        sa.Column('metrics', sa.JSON(), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('error_message', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_model_runs_dataset_id', 'model_runs', ['dataset_id'])
    op.create_index('ix_model_runs_task_id', 'model_runs', ['task_id'])

    # 5. Create entities table
    op.create_table(
        'entities',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('wallet_address', sa.String(), nullable=False),
        sa.Column('cluster_id', sa.Integer(), nullable=True),
        sa.Column('entity_label', sa.String(), nullable=True),
        sa.Column('risk_score', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('tx_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_sent', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('total_received', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('first_seen', sa.DateTime(), nullable=True),
        sa.Column('last_seen', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_entities_wallet_address', 'entities', ['wallet_address'], unique=True)


def downgrade() -> None:
    # Drop tables in reverse dependency order
    op.drop_table('entities')
    op.drop_table('model_runs')
    op.drop_table('alerts')
    op.drop_table('transactions')
    op.drop_table('datasets')
