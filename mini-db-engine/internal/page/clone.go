package page

import (
	"bytes"
)

// ClonePage creates a deep copy of a page by serializing and deserializing it.
// This ensures that modifications to the original page don't affect the clone.
func ClonePage(page interface{}) interface{} {
	if page == nil {
		return nil
	}

	var buf bytes.Buffer
	
	// Serialize the page
	switch p := page.(type) {
	case *MetaPage:
		if err := p.WriteToBuffer(&buf); err != nil {
			return nil
		}
		// Deserialize
		r := bytes.NewReader(buf.Bytes())
		var hdr PageHeader
		if err := hdr.ReadFromBuffer(r); err != nil {
			return nil
		}
		m := &MetaPage{Header: hdr}
		if err := m.ReadFromBuffer(r); err != nil {
			return nil
		}
		return m
		
	case *InternalPage:
		if err := p.WriteToBuffer(&buf); err != nil {
			return nil
		}
		// Deserialize
		r := bytes.NewReader(buf.Bytes())
		var hdr PageHeader
		if err := hdr.ReadFromBuffer(r); err != nil {
			return nil
		}
		ip := &InternalPage{Header: hdr}
		if err := ip.ReadFromBuffer(r); err != nil {
			return nil
		}
		return ip
		
	case *LeafPage:
		if err := p.WriteToBuffer(&buf); err != nil {
			return nil
		}
		// Deserialize
		r := bytes.NewReader(buf.Bytes())
		var hdr PageHeader
		if err := hdr.ReadFromBuffer(r); err != nil {
			return nil
		}
		lp := &LeafPage{Header: hdr}
		if err := lp.ReadFromBuffer(r); err != nil {
			return nil
		}
		return lp
		
	default:
		return nil
	}
}
