"""
AlgoDAO — Governance Token Creation Script
Creates the ADAO governance token (ASA) on Algorand Testnet
Run BEFORE deploying the main DAO contract.

Usage:
    python scripts/create_token.py --network testnet
"""

import argparse
import json
import os
import sys
from pathlib import Path

from algokit_utils import AlgoAmount, AlgorandClient
from algosdk import mnemonic, transaction


def create_governance_token(network: str = "testnet") -> dict:
    """Mint the ADAO governance token ASA"""

    print(f"\n🏛  AlgoDAO — Creating Governance Token on {network.upper()}")
    print("=" * 55)

    # Connect
    if network == "localnet":
        algorand = AlgorandClient.default_local_net()
        creator = algorand.account.kmd.get_or_create_wallet_account(
            "deployer", AlgoAmount.from_algos(1000)
        )
    else:
        algorand = AlgorandClient.testnet()
        mnemonic_phrase = os.environ.get("DEPLOYER_MNEMONIC")
        if not mnemonic_phrase:
            print("❌ Set DEPLOYER_MNEMONIC environment variable")
            sys.exit(1)
        private_key = mnemonic.to_private_key(mnemonic_phrase)
        creator = algorand.account.from_private_key(private_key)

    print(f"📍 Creator: {creator.address}")

    sp = algorand.client.algod.suggested_params()

    # Create ASA: ADAO Governance Token
    txn = transaction.AssetConfigTxn(
        sender=creator.address,
        sp=sp,
        default_frozen=False,
        unit_name="ADAO",
        asset_name="AlgoDAO Governance Token",
        manager=creator.address,
        reserve=creator.address,
        freeze=creator.address,
        clawback=creator.address,
        url="https://algodao.app",
        total=10_000_000,       # 10 million tokens total supply
        decimals=0,              # Whole tokens only
    )

    signed_txn = txn.sign(mnemonic.to_private_key(mnemonic_phrase) if network != "localnet" else creator.private_key)
    tx_id = algorand.client.algod.send_transaction(signed_txn)

    # Wait for confirmation
    result = transaction.wait_for_confirmation(algorand.client.algod, tx_id, 4)
    asset_id = result["asset-index"]

    print(f"\n✅ Governance Token Created!")
    print(f"   Token Name: AlgoDAO Governance Token (ADAO)")
    print(f"   ASA ID:     {asset_id}")
    print(f"   Total Supply: 10,000,000 ADAO")
    print(f"   Decimals: 0")
    print(f"   Tx ID: {tx_id}")
    print(f"\n⚠️  Save your ASA ID: {asset_id}")
    print(f"   Use this as governance_token_id when deploying DAO contract")

    info = {"asset_id": asset_id, "tx_id": tx_id, "creator": creator.address, "network": network}
    with open("governance_token.json", "w") as f:
        json.dump(info, f, indent=2)
    print(f"\n💾 Saved to governance_token.json")
    return info


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--network", choices=["localnet", "testnet"], default="testnet")
    args = parser.parse_args()
    create_governance_token(args.network)
