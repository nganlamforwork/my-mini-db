package storage

import (
	"encoding/json"
	"testing"
)

func TestSchema_ValidateRow(t *testing.T) {
	// Create a schema with columns A (INT), B (STRING), C (INT)
	// Primary key is [C, A]
	schema, err := NewSchema(
		[]ColumnDefinition{
			{Name: "A", Type: TypeInt},
			{Name: "B", Type: TypeString},
			{Name: "C", Type: TypeInt},
		},
		[]string{"C", "A"},
	)
	if err != nil {
		t.Fatalf("Failed to create schema: %v", err)
	}

	tests := []struct {
		name    string
		row     map[string]interface{}
		wantErr bool
	}{
		{
			name: "valid row",
			row: map[string]interface{}{
				"A": int64(1),
				"B": "test",
				"C": int64(3),
			},
			wantErr: false,
		},
		{
			name: "missing column",
			row: map[string]interface{}{
				"A": int64(1),
				"C": int64(3),
			},
			wantErr: true,
		},
		{
			name: "wrong type",
			row: map[string]interface{}{
				"A": "not an int",
				"B": "test",
				"C": int64(3),
			},
			wantErr: true,
		},
		{
			name: "missing primary key column",
			row: map[string]interface{}{
				"A": int64(1),
				"B": "test",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := schema.ValidateRow(tt.row)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateRow() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestSchema_ExtractKey(t *testing.T) {
	// Create a schema with columns A (INT), B (STRING), C (INT)
	// Primary key is [C, A] - order matters!
	schema, err := NewSchema(
		[]ColumnDefinition{
			{Name: "A", Type: TypeInt},
			{Name: "B", Type: TypeString},
			{Name: "C", Type: TypeInt},
		},
		[]string{"C", "A"},
	)
	if err != nil {
		t.Fatalf("Failed to create schema: %v", err)
	}

	// Test case: input {A:1, B:2, C:3} must generate Key [3, 1]
	row := map[string]interface{}{
		"A": int64(1),
		"B": "test",
		"C": int64(3),
	}

	key, err := schema.ExtractKey(row)
	if err != nil {
		t.Fatalf("ExtractKey() error = %v", err)
	}

	// Verify key has 2 values (C and A)
	if len(key.Values) != 2 {
		t.Fatalf("Expected key to have 2 values, got %d", len(key.Values))
	}

	// Verify first value is C (3)
	if key.Values[0].Type != TypeInt {
		t.Errorf("Expected first key value to be TypeInt, got %v", key.Values[0].Type)
	}
	if key.Values[0].Value.(int64) != 3 {
		t.Errorf("Expected first key value to be 3, got %v", key.Values[0].Value)
	}

	// Verify second value is A (1)
	if key.Values[1].Type != TypeInt {
		t.Errorf("Expected second key value to be TypeInt, got %v", key.Values[1].Type)
	}
	if key.Values[1].Value.(int64) != 1 {
		t.Errorf("Expected second key value to be 1, got %v", key.Values[1].Value)
	}
}

func TestSchema_ExtractKey_JSONNumber(t *testing.T) {
	// Test with json.Number (common when parsing JSON)
	schema, err := NewSchema(
		[]ColumnDefinition{
			{Name: "id", Type: TypeInt},
			{Name: "name", Type: TypeString},
		},
		[]string{"id"},
	)
	if err != nil {
		t.Fatalf("Failed to create schema: %v", err)
	}

	// Simulate JSON parsing
	jsonStr := `{"id": 42, "name": "test"}`
	var row map[string]interface{}
	if err := json.Unmarshal([]byte(jsonStr), &row); err != nil {
		t.Fatalf("Failed to parse JSON: %v", err)
	}

	key, err := schema.ExtractKey(row)
	if err != nil {
		t.Fatalf("ExtractKey() error = %v", err)
	}

	if len(key.Values) != 1 {
		t.Fatalf("Expected key to have 1 value, got %d", len(key.Values))
	}

	if key.Values[0].Value.(int64) != 42 {
		t.Errorf("Expected key value to be 42, got %v", key.Values[0].Value)
	}
}

func TestSchema_RowToRecord(t *testing.T) {
	schema, err := NewSchema(
		[]ColumnDefinition{
			{Name: "A", Type: TypeInt},
			{Name: "B", Type: TypeString},
			{Name: "C", Type: TypeInt},
		},
		[]string{"C", "A"},
	)
	if err != nil {
		t.Fatalf("Failed to create schema: %v", err)
	}

	row := map[string]interface{}{
		"A": int64(1),
		"B": "test",
		"C": int64(3),
	}

	record, err := schema.RowToRecord(row)
	if err != nil {
		t.Fatalf("RowToRecord() error = %v", err)
	}

	// Verify record has 3 columns in schema order
	if len(record.Columns) != 3 {
		t.Fatalf("Expected record to have 3 columns, got %d", len(record.Columns))
	}

	// Verify column order matches schema
	if record.Columns[0].Value.(int64) != 1 {
		t.Errorf("Expected first column (A) to be 1, got %v", record.Columns[0].Value)
	}
	if record.Columns[1].Value.(string) != "test" {
		t.Errorf("Expected second column (B) to be 'test', got %v", record.Columns[1].Value)
	}
	if record.Columns[2].Value.(int64) != 3 {
		t.Errorf("Expected third column (C) to be 3, got %v", record.Columns[2].Value)
	}
}

func TestCompositeKey_Compare_WithSchemaOrder(t *testing.T) {
	// Test that keys extracted with different primary key orders compare correctly
	schema1, _ := NewSchema(
		[]ColumnDefinition{
			{Name: "A", Type: TypeInt},
			{Name: "B", Type: TypeInt},
		},
		[]string{"A", "B"}, // PK order: A, B
	)

	schema2, _ := NewSchema(
		[]ColumnDefinition{
			{Name: "A", Type: TypeInt},
			{Name: "B", Type: TypeInt},
		},
		[]string{"B", "A"}, // PK order: B, A
	)

	// Same row, different key extraction orders
	row := map[string]interface{}{
		"A": int64(1),
		"B": int64(2),
	}

	key1, _ := schema1.ExtractKey(row) // Key: [1, 2]
	key2, _ := schema2.ExtractKey(row) // Key: [2, 1]

	// These should be different keys
	if key1.Compare(key2) == 0 {
		t.Error("Keys with different primary key orders should not be equal")
	}

	// key1 [1, 2] should be less than key2 [2, 1] (first element comparison)
	if key1.Compare(key2) >= 0 {
		t.Error("Expected key1 [1,2] < key2 [2,1]")
	}
}

func TestSchema_ValidateKey(t *testing.T) {
	// Create a schema with columns A (INT), B (STRING), C (INT)
	// Primary key is [C, A]
	schema, err := NewSchema(
		[]ColumnDefinition{
			{Name: "A", Type: TypeInt},
			{Name: "B", Type: TypeString},
			{Name: "C", Type: TypeInt},
		},
		[]string{"C", "A"},
	)
	if err != nil {
		t.Fatalf("Failed to create schema: %v", err)
	}

	tests := []struct {
		name    string
		keyData map[string]interface{}
		wantErr bool
	}{
		{
			name: "valid key with only primary key fields",
			keyData: map[string]interface{}{
				"A": int64(1),
				"C": int64(3),
			},
			wantErr: false,
		},
		{
			name: "valid key with extra non-key fields (should be ignored)",
			keyData: map[string]interface{}{
				"A": int64(1),
				"B": "test", // Non-key field, should be ignored
				"C": int64(3),
			},
			wantErr: false,
		},
		{
			name: "missing primary key column",
			keyData: map[string]interface{}{
				"A": int64(1),
				// Missing C
			},
			wantErr: true,
		},
		{
			name: "wrong type in primary key column",
			keyData: map[string]interface{}{
				"A": "not an int", // Wrong type
				"C": int64(3),
			},
			wantErr: true,
		},
		{
			name: "missing all primary key columns",
			keyData: map[string]interface{}{
				"B": "test", // Only non-key field
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := schema.ValidateKey(tt.keyData)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateKey() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestSchema_ExtractKeyFromKeyData(t *testing.T) {
	// Create a schema with columns A (INT), B (STRING), C (INT)
	// Primary key is [C, A] - order matters!
	schema, err := NewSchema(
		[]ColumnDefinition{
			{Name: "A", Type: TypeInt},
			{Name: "B", Type: TypeString},
			{Name: "C", Type: TypeInt},
		},
		[]string{"C", "A"},
	)
	if err != nil {
		t.Fatalf("Failed to create schema: %v", err)
	}

	// Test case: input {A:1, C:3} (only key fields) must generate Key [3, 1]
	keyData := map[string]interface{}{
		"A": int64(1),
		"C": int64(3),
	}

	key, err := schema.ExtractKeyFromKeyData(keyData)
	if err != nil {
		t.Fatalf("ExtractKeyFromKeyData() error = %v", err)
	}

	// Verify key has 2 values (C and A)
	if len(key.Values) != 2 {
		t.Fatalf("Expected key to have 2 values, got %d", len(key.Values))
	}

	// Verify first value is C (3)
	if key.Values[0].Type != TypeInt {
		t.Errorf("Expected first key value to be TypeInt, got %v", key.Values[0].Type)
	}
	if key.Values[0].Value.(int64) != 3 {
		t.Errorf("Expected first key value to be 3, got %v", key.Values[0].Value)
	}

	// Verify second value is A (1)
	if key.Values[1].Type != TypeInt {
		t.Errorf("Expected second key value to be TypeInt, got %v", key.Values[1].Type)
	}
	if key.Values[1].Value.(int64) != 1 {
		t.Errorf("Expected second key value to be 1, got %v", key.Values[1].Value)
	}

	// Test that ExtractKeyFromKeyData produces the same result as ExtractKey for key fields
	fullRow := map[string]interface{}{
		"A": int64(1),
		"B": "test",
		"C": int64(3),
	}
	keyFromFullRow, err := schema.ExtractKey(fullRow)
	if err != nil {
		t.Fatalf("ExtractKey() error = %v", err)
	}

	// Both keys should be equal
	if key.Compare(keyFromFullRow) != 0 {
		t.Error("ExtractKeyFromKeyData() and ExtractKey() should produce the same key for the same key values")
	}

	// Test that non-key fields are ignored
	keyDataWithExtra := map[string]interface{}{
		"A": int64(1),
		"B": "ignored", // Non-key field, should be ignored
		"C": int64(3),
		"D": "also ignored", // Non-existent field, should be ignored
	}
	keyWithExtra, err := schema.ExtractKeyFromKeyData(keyDataWithExtra)
	if err != nil {
		t.Fatalf("ExtractKeyFromKeyData() with extra fields error = %v", err)
	}

	// Should produce the same key
	if key.Compare(keyWithExtra) != 0 {
		t.Error("ExtractKeyFromKeyData() should ignore non-key fields")
	}
}
