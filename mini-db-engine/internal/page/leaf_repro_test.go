package page

import (
	"bplustree/internal/storage"
	"bytes"
	"testing"
)

func TestLeafPageSerialization(t *testing.T) {
	// Create leaf page
	p := NewLeafPage(2)
	
	// Add key/value
	key := storage.NewCompositeKey(storage.NewInt(10))
	val := storage.NewRecord(storage.NewString("v10"))
	
	// Manually insert (bypass InsertIntoLeaf to isolate serialization)
	p.Keys = append(p.Keys, key)
	p.Values = append(p.Values, val)
	p.Header.KeyCount = 1
	
	// Serialize
	buf := new(bytes.Buffer)
	if err := p.WriteToBuffer(buf); err != nil {
		t.Fatalf("WriteToBuffer failed: %v", err)
	}
	
	t.Logf("Serialized size: %d", buf.Len())
	
	// Deserialize
	r := bytes.NewReader(buf.Bytes())
	
	p2 := &LeafPage{}
	// Read header first
	if err := p2.Header.ReadFromBuffer(r); err != nil {
		t.Fatalf("Header.ReadFromBuffer failed: %v", err)
	}
	
	if p2.Header.KeyCount != 1 {
		t.Fatalf("KeyCount mismatch: got %d, expected 1", p2.Header.KeyCount)
	}
	
	// Read content
	if err := p2.ReadFromBuffer(r); err != nil {
		t.Fatalf("LeafPage.ReadFromBuffer failed: %v", err)
	}
	
	if len(p2.Keys) != 1 {
		t.Fatalf("Keys len mismatch: got %d", len(p2.Keys))
	}
	
	col := p2.Values[0].Columns[0]
	if col.Value.(string) != "v10" {
		t.Fatalf("Value mismatch: got %v", col.Value)
	}
}
