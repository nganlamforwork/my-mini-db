package btree

import (
	"bplustree/internal/storage"
	"os"
	"testing"
)

// TestSchemaKeyOrdering tests that keys are sorted correctly based on primary key column order
// This verifies that if PK is [Key Part 2, Key Part 1], records are sorted by Part 2 first, then Part 1
func TestSchemaKeyOrdering(t *testing.T) {
	// Create a temporary database file
	filename := "test_schema_ordering.db"
	defer os.Remove(filename)
	defer os.Remove(filename + ".wal")

	// Create schema with columns A (INT), B (INT), C (STRING)
	// Primary key is [C, A] - meaning records are sorted by C first, then A
	schema, err := storage.NewSchema(
		[]storage.ColumnDefinition{
			{Name: "A", Type: storage.TypeInt},
			{Name: "B", Type: storage.TypeInt},
			{Name: "C", Type: storage.TypeString},
		},
		[]string{"C", "A"}, // PK order: C first, then A
	)
	if err != nil {
		t.Fatalf("Failed to create schema: %v", err)
	}

	// Create tree with schema
	tree, err := NewBPlusTree(filename, true)
	if err != nil {
		t.Fatalf("Failed to create tree: %v", err)
	}
	defer tree.Close()

	tree.SetSchema(schema)

	// Insert rows in a specific order
	rows := []map[string]interface{}{
		{"A": int64(2), "B": int64(10), "C": "zebra"},  // Key: ["zebra", 2]
		{"A": int64(1), "B": int64(20), "C": "apple"},  // Key: ["apple", 1]
		{"A": int64(3), "B": int64(30), "C": "apple"},  // Key: ["apple", 3]
		{"A": int64(1), "B": int64(40), "C": "zebra"},  // Key: ["zebra", 1]
	}

	for _, row := range rows {
		// Validate and extract key
		key, err := schema.ExtractKey(row)
		if err != nil {
			t.Fatalf("Failed to extract key: %v", err)
		}

		// Convert row to record
		record, err := schema.RowToRecord(row)
		if err != nil {
			t.Fatalf("Failed to convert row to record: %v", err)
		}

		// Insert into tree
		if err := tree.Insert(key, record); err != nil {
			t.Fatalf("Failed to insert: %v", err)
		}
	}

	// Expected order after insertion (sorted by PK [C, A]):
	// 1. ["apple", 1] - A=1, B=20, C="apple"
	// 2. ["apple", 3] - A=3, B=30, C="apple"
	// 3. ["zebra", 1] - A=1, B=40, C="zebra"
	// 4. ["zebra", 2] - A=2, B=10, C="zebra"

	// Verify keys are sorted correctly by searching in order
	expectedKeys := []storage.CompositeKey{
		storage.NewCompositeKey(
			storage.NewString("apple"),
			storage.NewInt(1),
		),
		storage.NewCompositeKey(
			storage.NewString("apple"),
			storage.NewInt(3),
		),
		storage.NewCompositeKey(
			storage.NewString("zebra"),
			storage.NewInt(1),
		),
		storage.NewCompositeKey(
			storage.NewString("zebra"),
			storage.NewInt(2),
		),
	}

	// Search for each key and verify order
	for i, expectedKey := range expectedKeys {
		value, err := tree.Search(expectedKey)
		if err != nil {
			t.Fatalf("Failed to search for key %d: %v", i, err)
		}

		// Verify we got the correct record
		// Expected records in order:
		// 0: A=1, B=20, C="apple"
		// 1: A=3, B=30, C="apple"
		// 2: A=1, B=40, C="zebra"
		// 3: A=2, B=10, C="zebra"
		expectedBValues := []int64{20, 30, 40, 10}
		if len(value.Columns) != 3 {
			t.Fatalf("Expected 3 columns, got %d", len(value.Columns))
		}
		if value.Columns[1].Value.(int64) != expectedBValues[i] {
			t.Errorf("Key %d: Expected B=%d, got %v", i, expectedBValues[i], value.Columns[1].Value)
		}
	}

	// Test range query to verify ordering
	startKey := storage.NewCompositeKey(
		storage.NewString("apple"),
		storage.NewInt(1),
	)
	endKey := storage.NewCompositeKey(
		storage.NewString("zebra"),
		storage.NewInt(2),
	)

	keys, _, err := tree.SearchRange(startKey, endKey)
	if err != nil {
		t.Fatalf("Failed to search range: %v", err)
	}

	if len(keys) != 4 {
		t.Fatalf("Expected 4 keys in range, got %d", len(keys))
	}

	// Verify keys are in correct order
	for i := 0; i < len(keys)-1; i++ {
		if keys[i].Compare(keys[i+1]) > 0 {
			t.Errorf("Keys are not in sorted order: keys[%d] > keys[%d]", i, i+1)
		}
	}
}

// TestSchemaValidation tests that row validation works correctly
func TestSchemaValidation(t *testing.T) {
	schema, err := storage.NewSchema(
		[]storage.ColumnDefinition{
			{Name: "id", Type: storage.TypeInt},
			{Name: "name", Type: storage.TypeString},
			{Name: "age", Type: storage.TypeInt},
		},
		[]string{"id"},
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
				"id":   int64(1),
				"name": "Alice",
				"age":  int64(25),
			},
			wantErr: false,
		},
		{
			name: "missing column",
			row: map[string]interface{}{
				"id":   int64(1),
				"name": "Alice",
			},
			wantErr: true,
		},
		{
			name: "wrong type",
			row: map[string]interface{}{
				"id":   "not an int",
				"name": "Alice",
				"age":  int64(25),
			},
			wantErr: true,
		},
		{
			name: "missing primary key",
			row: map[string]interface{}{
				"name": "Alice",
				"age":  int64(25),
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

// TestSchemaKeyExtraction tests that keys are extracted in the correct order
func TestSchemaKeyExtraction(t *testing.T) {
	// Schema with PK [C, A] - order matters!
	schema, err := storage.NewSchema(
		[]storage.ColumnDefinition{
			{Name: "A", Type: storage.TypeInt},
			{Name: "B", Type: storage.TypeString},
			{Name: "C", Type: storage.TypeInt},
		},
		[]string{"C", "A"},
	)
	if err != nil {
		t.Fatalf("Failed to create schema: %v", err)
	}

	// Input: {A:1, B:2, C:3} must generate Key [3, 1]
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
	if key.Values[0].Type != storage.TypeInt {
		t.Errorf("Expected first key value to be TypeInt, got %v", key.Values[0].Type)
	}
	if key.Values[0].Value.(int64) != 3 {
		t.Errorf("Expected first key value to be 3, got %v", key.Values[0].Value)
	}

	// Verify second value is A (1)
	if key.Values[1].Type != storage.TypeInt {
		t.Errorf("Expected second key value to be TypeInt, got %v", key.Values[1].Type)
	}
	if key.Values[1].Value.(int64) != 1 {
		t.Errorf("Expected second key value to be 1, got %v", key.Values[1].Value)
	}
}
