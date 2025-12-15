package main

import (
	"bytes"
	"testing"
)

func TestMetaPage_WriteToBuffer(t *testing.T) {
	meta := &MetaPage{
		Header: PageHeader{
			PageID:    1,
			PageType:  PageTypeMeta,
			KeyCount:  0,
			FreeSpace: 4096,
		},
		RootPage: 2,
		PageSize: 4096,
		Order:    4,
		Version:  1,
	}

	buf := &bytes.Buffer{}
	if err := meta.WriteToBuffer(buf); err != nil {
		t.Fatalf("Failed to write MetaPage to buffer: %v", err)
	}

	if buf.Len() == 0 {
		t.Errorf("Expected non-empty buffer after writing MetaPage")
	}
}
