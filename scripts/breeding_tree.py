#!/usr/bin/env python3
"""Simple Dragon Warrior Monsters 2 breeding tree generator.

Asks for a goal monster and prints one possible breeding tree plus the
aggregate leaf monsters/families required.
"""

from __future__ import annotations

import argparse
import csv
import re
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple


DATA_DIR = Path(__file__).resolve().parents[1] / "public" / "data"
BREEDING_PAIRS_CSV = DATA_DIR / "breeding_pairs.csv"
FAMILY_FILES = {
    "beast.csv": "Beast",
    "bird.csv": "Bird",
    "boss.csv": "Boss",
    "bug.csv": "Bug",
    "devil.csv": "Devil",
    "dragon.csv": "Dragon",
    "material.csv": "Material",
    "plant.csv": "Plant",
    "slime.csv": "Slime",
    "water.csv": "Water",
    "zombie.csv": "Zombie",
}


@dataclass
class Node:
    label: str
    parent1: Optional["Node"] = None
    parent2: Optional["Node"] = None
    leaf_requirement: Optional[str] = None

    @property
    def is_leaf(self) -> bool:
        return self.parent1 is None and self.parent2 is None


Recipe = Tuple[str, str, str]
Plan = Tuple[Node, int]


def normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", text.lower())


def read_family_monsters() -> Dict[str, str]:
    """Map normalized monster name -> canonical display name."""
    monsters: Dict[str, str] = {}
    for filename in FAMILY_FILES:
        file_path = DATA_DIR / filename
        if not file_path.exists():
            continue
        with file_path.open("r", encoding="utf-8", newline="") as f:
            for raw in f:
                name = raw.strip()
                if not name:
                    continue
                monsters.setdefault(normalize(name), name)
    return monsters


def read_monster_families() -> Dict[str, str]:
    """Map normalized monster name -> family name."""
    monster_families: Dict[str, str] = {}
    for filename, family in FAMILY_FILES.items():
        file_path = DATA_DIR / filename
        if not file_path.exists():
            continue
        with file_path.open("r", encoding="utf-8", newline="") as f:
            for raw in f:
                name = raw.strip()
                if not name:
                    continue
                monster_families[normalize(name)] = family
    return monster_families


def read_recipes() -> Tuple[Dict[str, List[Recipe]], Dict[str, str]]:
    """Return recipes keyed by normalized result and display names by normalized key."""
    recipes: Dict[str, List[Recipe]] = {}
    display_names: Dict[str, str] = {}

    with BREEDING_PAIRS_CSV.open("r", encoding="utf-8", newline="") as f:
        reader = csv.reader(f)
        _ = next(reader, None)  # header
        for row in reader:
            if len(row) < 3:
                continue
            result = row[0].strip()
            parent1 = row[1].strip()
            parent2 = row[2].strip()
            if not result or not parent1 or not parent2:
                continue

            key = normalize(result)
            recipes.setdefault(key, []).append((result, parent1, parent2))
            display_names.setdefault(key, result)
            display_names.setdefault(normalize(parent1), parent1)
            display_names.setdefault(normalize(parent2), parent2)

    return recipes, display_names


def parse_any_family(token: str) -> Optional[str]:
    match = re.match(r"^\s*any\s+(.+?)\s*$", token, flags=re.IGNORECASE)
    if not match:
        return None
    family = match.group(1).strip()
    return family[:1].upper() + family[1:].lower()


def build_tree(
    monster_name: str,
    recipes: Dict[str, List[Recipe]],
    display_names: Dict[str, str],
    allowed_base_families: Optional[set[str]] = None,
    boss_base_monster: Optional[str] = None,
    memo: Optional[Dict[str, Plan]] = None,
    stack: Optional[set[str]] = None,
) -> Optional[Plan]:
    if memo is None:
        memo = {}
    if stack is None:
        stack = set()

    family = parse_any_family(monster_name)
    if family:
        if family == "Boss" and boss_base_monster:
            return build_tree(
                boss_base_monster,
                recipes,
                display_names,
                allowed_base_families,
                boss_base_monster,
                memo,
                stack,
            )
        if allowed_base_families is not None and family not in allowed_base_families:
            return None
        return (Node(label=f"1 {family}", leaf_requirement=family), 0)

    monster_key = normalize(monster_name)
    display = display_names.get(monster_key, monster_name)

    if monster_key in memo:
        return memo[monster_key]

    # Reject recursive loops for the current branch.
    if monster_key in stack:
        return None

    options = recipes.get(monster_key, [])
    if not options:
        # Force base requirements to be generic families only.
        return None

    best_plan: Optional[Plan] = None
    next_stack = set(stack)
    next_stack.add(monster_key)

    for _, p1, p2 in options:
        left_plan = build_tree(
            p1,
            recipes,
            display_names,
            allowed_base_families,
            boss_base_monster,
            memo,
            next_stack,
        )
        if left_plan is None:
            continue
        right_plan = build_tree(
            p2,
            recipes,
            display_names,
            allowed_base_families,
            boss_base_monster,
            memo,
            next_stack,
        )
        if right_plan is None:
            continue

        left_node, left_cost = left_plan
        right_node, right_cost = right_plan
        current_cost = left_cost + right_cost + 1
        current_node = Node(label=display, parent1=left_node, parent2=right_node)

        if best_plan is None or current_cost < best_plan[1]:
            best_plan = (current_node, current_cost)

    # Failures are context-sensitive (depend on current recursion stack),
    # so only memoize successful plans.
    if best_plan is not None:
        memo[monster_key] = best_plan
    return best_plan


def collect_steps_and_requirements(node: Node) -> Tuple[List[str], Counter[str]]:
    steps: List[str] = []
    needs: Counter[str] = Counter()

    def walk(current: Node) -> None:
        if current.is_leaf:
            if current.leaf_requirement:
                needs[current.leaf_requirement] += 1
            return

        assert current.parent1 is not None and current.parent2 is not None
        walk(current.parent1)
        walk(current.parent2)

        left = current.parent1.label if current.parent1.is_leaf else current.parent1.label
        right = current.parent2.label if current.parent2.is_leaf else current.parent2.label
        steps.append(f"{left} + {right} = {current.label}")

    walk(node)
    return steps, needs


def collect_exact_node_counts(node: Node, counts: Counter[str]) -> None:
    if node.is_leaf:
        return
    counts[normalize(node.label)] += 1
    assert node.parent1 is not None and node.parent2 is not None
    collect_exact_node_counts(node.parent1, counts)
    collect_exact_node_counts(node.parent2, counts)


def consume_family_requirement(
    family: str,
    owned: Counter[str],
    remaining_exact_nodes: Counter[str],
    monster_families: Dict[str, str],
) -> bool:
    # Prefer explicit family stock first.
    family_key = normalize(family)
    any_family_key = normalize(f"Any {family}")
    if owned[family_key] > 0:
        owned[family_key] -= 1
        return True
    if owned[any_family_key] > 0:
        owned[any_family_key] -= 1
        return True

    # Fallback: use owned specific monsters from this family, but only
    # if they are not still needed for exact nodes elsewhere in the tree.
    for owned_key, count in list(owned.items()):
        if count <= 0:
            continue
        if monster_families.get(owned_key) != family:
            continue
        if count <= remaining_exact_nodes[owned_key]:
            continue
        owned[owned_key] -= 1
        return True

    return False


def consume_owned_from_tree(
    node: Node,
    owned: Counter[str],
    remaining: Counter[str],
    remaining_exact_nodes: Counter[str],
    monster_families: Dict[str, str],
) -> None:
    """Reduce remaining base-family requirements by consuming owned monsters first."""
    monster_key = normalize(node.label)

    if not node.is_leaf:
        if owned[monster_key] > 0:
            owned[monster_key] -= 1
            remaining_exact_nodes[monster_key] -= 1
            return

        remaining_exact_nodes[monster_key] -= 1
        assert node.parent1 is not None and node.parent2 is not None
        consume_owned_from_tree(
            node.parent1, owned, remaining, remaining_exact_nodes, monster_families
        )
        consume_owned_from_tree(
            node.parent2, owned, remaining, remaining_exact_nodes, monster_families
        )
        return

    if node.leaf_requirement:
        consumed = consume_family_requirement(
            node.leaf_requirement, owned, remaining_exact_nodes, monster_families
        )
        if not consumed:
            remaining[node.leaf_requirement] += 1


def parse_owned_input(raw: str) -> Counter[str]:
    """Parse `Name=Count, Other Name=2` into normalized counter keys."""
    owned: Counter[str] = Counter()
    if not raw.strip():
        return owned

    parts = [part.strip() for part in raw.split(",") if part.strip()]
    for part in parts:
        if "=" in part:
            name, count_text = part.split("=", 1)
            name = name.strip()
            count_text = count_text.strip()
            if not name:
                continue
            try:
                count = int(count_text)
            except ValueError:
                continue
        else:
            name = part
            count = 1

        if count <= 0:
            continue
        owned[normalize(name)] += count

    return owned


def format_totals(needs: Counter[str]) -> str:
    total = sum(needs.values())
    parts = [f"{count} {name}" for name, count in sorted(needs.items(), key=lambda kv: kv[0].lower())]
    return f"Total monsters needed: {total} ({', '.join(parts)})"


def read_family_list(filename: str) -> List[str]:
    file_path = DATA_DIR / filename
    if not file_path.exists():
        return []
    monsters: List[str] = []
    with file_path.open("r", encoding="utf-8", newline="") as f:
        for raw in f:
            name = raw.strip()
            if name:
                monsters.append(name)
    return monsters


def resolve_goal_name(
    user_input: str, known_monsters: Dict[str, str], display_names: Dict[str, str]
) -> Optional[str]:
    key = normalize(user_input)
    return known_monsters.get(key) or display_names.get(key)


def print_plan(goal_name: str, plan: Optional[Plan]) -> None:
    if plan is None:
        print(f"No breeding recipe found for {goal_name}.")
        print("Could not reduce this target to generic family requirements only.")
        return

    tree, _ = plan
    steps, requirements = collect_steps_and_requirements(tree)

    print()
    print("One possible breeding tree:")
    for idx, step in enumerate(steps, start=1):
        print(f"{idx}. {step}")
    print()
    print(format_totals(requirements))


def find_best_boss(
    recipes: Dict[str, List[Recipe]],
    display_names: Dict[str, str],
    known_monsters: Dict[str, str],
    allowed_base_families: Optional[set[str]],
    boss_base_monster: Optional[str],
) -> Optional[Tuple[str, Plan, Counter[str], int]]:
    best: Optional[Tuple[str, Plan, Counter[str], int]] = None

    for boss in read_family_list("boss.csv"):
        goal_name = resolve_goal_name(boss, known_monsters, display_names)
        if not goal_name:
            continue
        plan = build_tree(
            goal_name, recipes, display_names, allowed_base_families, boss_base_monster
        )
        if plan is None:
            continue

        tree, step_count = plan
        _, requirements = collect_steps_and_requirements(tree)
        base_total = sum(requirements.values())

        if (
            best is None
            or base_total < best[3]
            or (base_total == best[3] and step_count < best[1][1])
        ):
            best = (goal_name, plan, requirements, base_total)

    return best


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate one DWM2 breeding tree.")
    parser.add_argument("--goal", type=str, help="Goal monster name (skip prompt).")
    parser.add_argument(
        "--no-base-boss",
        action="store_true",
        help="Disallow 'Any Boss' as a base family requirement.",
    )
    parser.add_argument(
        "--best-boss",
        action="store_true",
        help="Scan all Boss monsters and print the one with the fewest base family monsters.",
    )
    parser.add_argument(
        "--boss-base",
        type=str,
        default="Dracolord1",
        help="Monster to substitute whenever 'Any Boss' appears (default: Dracolord1).",
    )
    parser.add_argument(
        "--owned",
        type=str,
        default="",
        help="Owned monsters as comma-separated values, e.g. 'Dracolord1=1,Beast=2'.",
    )
    args = parser.parse_args()

    if not BREEDING_PAIRS_CSV.exists():
        print(f"Missing data file: {BREEDING_PAIRS_CSV}")
        return

    recipes, display_names = read_recipes()
    known_monsters = read_family_monsters()
    monster_families = read_monster_families()
    allowed_base_families = set(FAMILY_FILES.values())
    if args.no_base_boss:
        allowed_base_families.discard("Boss")
    boss_base_monster = args.boss_base.strip() if args.boss_base else None

    if args.best_boss:
        best = find_best_boss(
            recipes,
            display_names,
            known_monsters,
            allowed_base_families,
            boss_base_monster,
        )
        if best is None:
            print("No boss monster can be reduced under the current base-family constraints.")
            return

        goal_name, plan, requirements, base_total = best
        print(f"Best boss target: {goal_name}")
        print(f"Fewest base family monsters: {base_total}")
        print(format_totals(requirements))
        print_plan(goal_name, plan)
        return

    user_input = args.goal.strip() if args.goal else input("Goal monster: ").strip()
    if not user_input:
        print("No monster entered.")
        return

    goal_name = resolve_goal_name(user_input, known_monsters, display_names)
    if not goal_name:
        print(f"Unknown monster: {user_input}")
        return

    plan = build_tree(
        goal_name, recipes, display_names, allowed_base_families, boss_base_monster
    )
    print_plan(goal_name, plan)

    if plan is None:
        return

    tree, _ = plan
    owned_input = args.owned
    if not owned_input:
        owned_input = input(
            "\nOwned monsters (Name=Count, comma-separated, blank for none): "
        ).strip()

    owned = parse_owned_input(owned_input)
    remaining: Counter[str] = Counter()
    remaining_exact_nodes: Counter[str] = Counter()
    collect_exact_node_counts(tree, remaining_exact_nodes)
    consume_owned_from_tree(
        tree, owned, remaining, remaining_exact_nodes, monster_families
    )

    print()
    print("Remaining requirements after owned monsters:")
    print(format_totals(remaining))


if __name__ == "__main__":
    main()
