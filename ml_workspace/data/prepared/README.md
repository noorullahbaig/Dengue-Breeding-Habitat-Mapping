# Prepared Dataset Area

Raw datasets must not be trained directly unless an experiment explicitly states that it is measuring raw-source performance.

The first curated target should be:

```text
ml_workspace/data/prepared/retained_three_class_yolo/
```

Expected YOLO structure:

```text
retained_three_class_yolo/
  data.yaml
  train/images/
  train/labels/
  valid/images/
  valid/labels/
  test/images/
  test/labels/
```

Recommended retained class order:

```yaml
names:
  0: artificial_container
  1: drain_inlet
  2: tire
```

## Mapping Rules

- `Bottle` and `Vase` map to `artificial_container`.
- `Drain-Inlet` maps to `drain_inlet`.
- `Tire` maps to `tire`.
- `Coconut-Exocarp` is excluded from the current Kuala Lumpur urban reporting scope.
- MosquitoFusion `Breeding Place` images require manual review before assignment to any retained class.
- MosquitoFusion `Mosquito` and `Mosquito Swarm` labels are not habitat-class labels and should not be used directly for the retained habitat model.

Every curated dataset version should include a short manifest explaining source files, mapping decisions, exclusions, split ratios, and class counts.
