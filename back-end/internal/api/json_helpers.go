package api

import (
	"encoding/json"
	"fmt"
	"net/http"

	"bplustree/internal/storage"
)

// JSONCompositeKey is a JSON-serializable version of CompositeKey
type JSONCompositeKey struct {
	Values []JSONColumn `json:"values"`
}

// JSONRecord is a JSON-serializable version of Record
type JSONRecord struct {
	Columns []JSONColumn `json:"columns"`
}

// JSONColumn is a JSON-serializable version of Column
type JSONColumn struct {
	Type  string      `json:"type"`  // "int", "string", "float", "bool"
	Value interface{} `json:"value"`
}

// ToJSONCompositeKey converts a CompositeKey to JSONCompositeKey
func ToJSONCompositeKey(key storage.CompositeKey) JSONCompositeKey {
	values := make([]JSONColumn, len(key.Values))
	for i, col := range key.Values {
		values[i] = ToJSONColumn(col)
	}
	return JSONCompositeKey{Values: values}
}

// ToJSONRecord converts a Record to JSONRecord
func ToJSONRecord(record storage.Record) JSONRecord {
	columns := make([]JSONColumn, len(record.Columns))
	for i, col := range record.Columns {
		columns[i] = ToJSONColumn(col)
	}
	return JSONRecord{Columns: columns}
}

// ToJSONColumn converts a Column to JSONColumn
func ToJSONColumn(col storage.Column) JSONColumn {
	typeStr := ""
	switch col.Type {
	case storage.TypeInt:
		typeStr = "int"
	case storage.TypeString:
		typeStr = "string"
	case storage.TypeFloat:
		typeStr = "float"
	case storage.TypeBool:
		typeStr = "bool"
	}
	return JSONColumn{
		Type:  typeStr,
		Value: col.Value,
	}
}

// FromJSONCompositeKey converts a JSONCompositeKey to CompositeKey
func FromJSONCompositeKey(jsonKey JSONCompositeKey) (storage.CompositeKey, error) {
	values := make([]storage.Column, len(jsonKey.Values))
	for i, jsonCol := range jsonKey.Values {
		col, err := FromJSONColumn(jsonCol)
		if err != nil {
			return storage.CompositeKey{}, err
		}
		values[i] = col
	}
	return storage.CompositeKey{Values: values}, nil
}

// FromJSONRecord converts a JSONRecord to Record
func FromJSONRecord(jsonRecord JSONRecord) (storage.Record, error) {
	columns := make([]storage.Column, len(jsonRecord.Columns))
	for i, jsonCol := range jsonRecord.Columns {
		col, err := FromJSONColumn(jsonCol)
		if err != nil {
			return storage.Record{}, err
		}
		columns[i] = col
	}
	return storage.Record{Columns: columns}, nil
}

// FromJSONColumn converts a JSONColumn to Column
func FromJSONColumn(jsonCol JSONColumn) (storage.Column, error) {
	var colType storage.ColumnType
	switch jsonCol.Type {
	case "int":
		colType = storage.TypeInt
		// Ensure value is int64
		switch v := jsonCol.Value.(type) {
		case int64:
			return storage.Column{Type: colType, Value: v}, nil
		case float64:
			return storage.Column{Type: colType, Value: int64(v)}, nil
		case int:
			return storage.Column{Type: colType, Value: int64(v)}, nil
		default:
			return storage.Column{}, fmt.Errorf("invalid int value: %v", jsonCol.Value)
		}
	case "string":
		colType = storage.TypeString
		val, ok := jsonCol.Value.(string)
		if !ok {
			return storage.Column{}, fmt.Errorf("invalid string value: %v", jsonCol.Value)
		}
		return storage.Column{Type: colType, Value: val}, nil
	case "float":
		colType = storage.TypeFloat
		// Ensure value is float64
		switch v := jsonCol.Value.(type) {
		case float64:
			return storage.Column{Type: colType, Value: v}, nil
		case int:
			return storage.Column{Type: colType, Value: float64(v)}, nil
		case int64:
			return storage.Column{Type: colType, Value: float64(v)}, nil
		default:
			return storage.Column{}, fmt.Errorf("invalid float value: %v", jsonCol.Value)
		}
	case "bool":
		colType = storage.TypeBool
		val, ok := jsonCol.Value.(bool)
		if !ok {
			return storage.Column{}, fmt.Errorf("invalid bool value: %v", jsonCol.Value)
		}
		return storage.Column{Type: colType, Value: val}, nil
	default:
		return storage.Column{}, fmt.Errorf("unknown column type: %s", jsonCol.Type)
	}
}

// JSONStep is a JSON-serializable version of Step
type JSONStep struct {
	StepID       uint64                  `json:"step_id"`
	Type         string                  `json:"type"`
	NodeID       string                  `json:"nodeId,omitempty"`
	TargetID     string                  `json:"targetId,omitempty"`
	Key          *JSONCompositeKey       `json:"key,omitempty"`
	Value        *JSONRecord             `json:"value,omitempty"`
	Depth        int                     `json:"depth"`
	Metadata     map[string]interface{}  `json:"metadata,omitempty"`
	
	// Legacy fields
	Keys         []JSONCompositeKey      `json:"keys,omitempty"`
	HighlightKey *JSONCompositeKey       `json:"highlightKey,omitempty"`
	Children     []uint64                `json:"children,omitempty"`
	OriginalNode string                  `json:"originalNode,omitempty"`
	NewNode      string                  `json:"newNode,omitempty"`
	NewNodes     []string                `json:"newNodes,omitempty"`
	SeparatorKey *JSONCompositeKey       `json:"separatorKey,omitempty"`
	LSN          uint64                  `json:"lsn,omitempty"`
	PageID       string                  `json:"pageId,omitempty"`
	TargetNodeID string                  `json:"targetNodeId,omitempty"`
	IsOverflow   bool                    `json:"isOverflow,omitempty"`
	Order        int                     `json:"order,omitempty"`
}

// ToJSONStep converts a Step to JSONStep
func ToJSONStep(step Step) JSONStep {
	jsonStep := JSONStep{
		StepID:       step.StepID,
		Type:         string(step.Type),
		NodeID:       step.NodeID,
		TargetID:     step.TargetID,
		Depth:        step.Depth,
		Metadata:     step.Metadata,
		Children:     step.Children,
		OriginalNode: step.OriginalNode,
		NewNode:      step.NewNode,
		NewNodes:     step.NewNodes,
		LSN:          step.LSN,
		PageID:       step.PageID,
		TargetNodeID: step.TargetNodeID,
		IsOverflow:   step.IsOverflow,
		Order:        step.Order,
	}

	if step.Keys != nil {
		jsonStep.Keys = make([]JSONCompositeKey, len(step.Keys))
		for i, k := range step.Keys {
			jsonStep.Keys[i] = ToJSONCompositeKey(k)
		}
	}

	if step.HighlightKey != nil {
		hk := ToJSONCompositeKey(*step.HighlightKey)
		jsonStep.HighlightKey = &hk
	}

	if step.SeparatorKey != nil {
		sk := ToJSONCompositeKey(*step.SeparatorKey)
		jsonStep.SeparatorKey = &sk
	}

	if step.Key != nil {
		k := ToJSONCompositeKey(*step.Key)
		jsonStep.Key = &k
	}

	if step.Value != nil {
		v := ToJSONRecord(*step.Value)
		jsonStep.Value = &v
	}

	return jsonStep
}

// ToJSONSteps converts a slice of Steps to JSONSteps
func ToJSONSteps(steps []Step) []JSONStep {
	jsonSteps := make([]JSONStep, len(steps))
	for i, step := range steps {
		jsonSteps[i] = ToJSONStep(step)
	}
	return jsonSteps
}

// JSONOperationResponse is a JSON-serializable version of OperationResponse
type JSONOperationResponse struct {
	Success   bool             `json:"success"`
	Operation string           `json:"operation"`
	Key       *JSONCompositeKey `json:"key,omitempty"`
	Value     *JSONRecord       `json:"value,omitempty"`
	Error     string           `json:"error,omitempty"`
	Steps     []JSONStep       `json:"steps"`
}

// ToJSONOperationResponse converts an OperationResponse to JSONOperationResponse
func ToJSONOperationResponse(resp OperationResponse) JSONOperationResponse {
	jsonResp := JSONOperationResponse{
		Success:   resp.Success,
		Operation: resp.Operation,
		Error:     resp.Error,
		Steps:     ToJSONSteps(resp.Steps),
	}

	if resp.Key != nil {
		k := ToJSONCompositeKey(*resp.Key)
		jsonResp.Key = &k
	}

	if resp.Value != nil {
		v := ToJSONRecord(*resp.Value)
		jsonResp.Value = &v
	}

	return jsonResp
}

// WriteJSONResponse writes a JSON response with appropriate headers
func WriteJSONResponse(w http.ResponseWriter, statusCode int, data interface{}) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	return json.NewEncoder(w).Encode(data)
}