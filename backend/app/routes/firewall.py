from fastapi import APIRouter, HTTPException, status

from app.schemas.firewall import FirewallRuleCreate, FirewallRuleResponse
from app.services import firewall as firewall_service

router = APIRouter()


@router.get("/rules", response_model=list[FirewallRuleResponse])
async def list_rules():
    """Return all whitelist firewall rules."""
    return await firewall_service.get_all_rules()


@router.post("/rules", response_model=FirewallRuleResponse, status_code=status.HTTP_201_CREATED)
async def add_rule(rule: FirewallRuleCreate):
    """Add a new whitelist rule for a device."""
    return await firewall_service.add_rule(rule)


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule(rule_id: int):
    """Remove a whitelist rule by ID."""
    deleted = await firewall_service.delete_rule(rule_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rule {rule_id} not found",
        )


@router.post("/apply")
async def apply_rules():
    """Translate all DB rules into iptables commands and apply them."""
    await firewall_service.apply_all_rules()
    return {"message": "Firewall rules applied"}
