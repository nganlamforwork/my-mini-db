package api

import (
	"bplustree/internal/btree"
	"bplustree/internal/storage"
)

// convertBTreeStepToAPIStep converts a btree.Step to an api.Step
func convertBTreeStepToAPIStep(btStep btree.Step) Step {
	apiStep := Step{
		StepID:   btStep.StepID,
		Type:     StepType(btStep.Type),
		NodeID:   btStep.NodeID,
		TargetID: btStep.TargetID,
		Key:      btStep.Key,
		Value:    btStep.Value,
		Depth:    btStep.Depth,
		Metadata: btStep.Metadata,
	}

	// For backward compatibility, populate legacy fields from metadata
	if btStep.Metadata != nil {
		// Extract keys if present in metadata
		if keysVal, ok := btStep.Metadata["keys"]; ok {
			if keys, ok := keysVal.([]storage.CompositeKey); ok {
				apiStep.Keys = keys
			}
		}
		// Extract separator key if present
		if sepKeyVal, ok := btStep.Metadata["separator_key"]; ok {
			if sepKey, ok := sepKeyVal.(*storage.CompositeKey); ok {
				apiStep.SeparatorKey = sepKey
			}
		}
		// Extract children if present
		if childrenVal, ok := btStep.Metadata["children"]; ok {
			if children, ok := childrenVal.([]uint64); ok {
				apiStep.Children = children
			}
		}
		// Extract overflow info
		if isOverflow, ok := btStep.Metadata["is_overflow"].(bool); ok {
			apiStep.IsOverflow = isOverflow
		}
		// Extract order
		if order, ok := btStep.Metadata["order"].(int); ok {
			apiStep.Order = order
		}
		// For split nodes, extract new node info
		if btStep.Type == btree.StepTypeNodeSplit {
			if btStep.TargetID != "" {
				apiStep.NewNode = btStep.TargetID
				apiStep.NewNodes = []string{btStep.NodeID, btStep.TargetID}
				apiStep.OriginalNode = btStep.NodeID
			}
		}
		// For merge nodes, extract deleted node
		if btStep.Type == btree.StepTypeMergeNodes {
			if deletedNodeID, ok := btStep.Metadata["deleted_node_id"].(string); ok {
				apiStep.OriginalNode = deletedNodeID
			}
		}
	}

	// Set TargetNodeID for backward compatibility
	if btStep.TargetID != "" {
		apiStep.TargetNodeID = btStep.TargetID
	}

	// Set HighlightKey to Key for traversal steps
	if btStep.Type == btree.StepTypeNodeVisit || btStep.Type == btree.StepTypeKeyComparison {
		apiStep.HighlightKey = btStep.Key
	}

	return apiStep
}

// convertBTreeStepsToAPISteps converts a slice of btree.Step to api.Step
func convertBTreeStepsToAPISteps(btSteps []btree.Step) []Step {
	apiSteps := make([]Step, len(btSteps))
	for i, btStep := range btSteps {
		apiSteps[i] = convertBTreeStepToAPIStep(btStep)
	}
	return apiSteps
}
