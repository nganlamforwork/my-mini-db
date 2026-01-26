package storage

import (
	"bytes"
	"testing"
)

func TestRecordSerialization(t *testing.T) {
	// Create a record with a string
	rec := NewRecord(NewString("v10"))
	
	// Serialize
	buf := new(bytes.Buffer)
	if err := rec.WriteTo(buf); err != nil {
		t.Fatalf("WriteTo failed: %v", err)
	}
	
	// Deserialize
	rec2, err := ReadRecordFrom(buf)
	if err != nil {
		t.Fatalf("ReadRecordFrom failed: %v", err)
	}
	
	// Check content
	if len(rec2.Columns) != 1 {
		t.Fatalf("Expected 1 column, got %d", len(rec2.Columns))
	}
	
	col := rec2.Columns[0]
	if col.Type != TypeString {
		t.Fatalf("Expected TypeString, got %v", col.Type)
	}
	
	if col.Value == nil {
		t.Fatalf("col.Value is nil!")
	}
	
	s, ok := col.Value.(string)
	if !ok {
		t.Fatalf("col.Value is not string, it is %T", col.Value)
	}
	if s != "v10" {
		t.Fatalf("Expected 'v10', got '%s'", s)
	}
}
