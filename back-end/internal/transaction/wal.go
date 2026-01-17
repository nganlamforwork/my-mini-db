package transaction

import (
	"bplustree/internal/page"
	"bytes"
	"encoding/binary"
	"fmt"
	"io"
	"os"
)

// WALEntryType represents the type of operation in a WAL entry
type WALEntryType uint8

const (
	WALEntryInsert WALEntryType = iota
	WALEntryUpdate
	WALEntryDelete
	WALEntryCheckpoint
)

// WALEntry represents a single log entry in the Write-Ahead Log
type WALEntry struct {
	LSN      uint64      	// Log Sequence Number
	Type     WALEntryType	// Insert, Update, Delete, Checkpoint
	PageID   uint64			// Page identifier
	PageData []byte 		// Serialized page data (page header + page body)
}

// WALManager manages the Write-Ahead Log for durability and recovery
type WALManager struct {
	file     *os.File		// WAL file
	nextLSN  uint64			// Next LSN to assign
	pageSize int			// Page size
}

// Constructor to create a new WAL manager for the given database file
func NewWALManager(dbFilename string) (*WALManager, error) {
	walFilename := dbFilename + ".wal"
	
	// Open or create WAL file
	file, err := os.OpenFile(walFilename, os.O_RDWR|os.O_CREATE|os.O_APPEND, 0666)
	if err != nil {
		return nil, fmt.Errorf("failed to open WAL file: %w", err)
	}

	wal := &WALManager{
		file:     file,
		nextLSN:  1,
		pageSize: page.DefaultPageSize,
	}

	// Recover LSN from existing WAL if present
	if err := wal.recoverLSN(); err != nil {
		return nil, fmt.Errorf("failed to recover LSN: %w", err)
	}

	return wal, nil
}

// Function to scan the WAL file to find the highest LSN
func (w *WALManager) recoverLSN() error {
	// Get file size
	stat, err := w.file.Stat()
	if err != nil {
		return err
	}

	if stat.Size() == 0 {
		w.nextLSN = 1
		return nil
	}

	// Read from beginning to find highest LSN
	_, err = w.file.Seek(0, io.SeekStart)
	if err != nil {
		return err
	}

	maxLSN := uint64(0)
	for {
		var lsn uint64
		if err := binary.Read(w.file, binary.BigEndian, &lsn); err != nil {
			if err == io.EOF {
				break
			}
			return err
		}

		if lsn > maxLSN {
			maxLSN = lsn
		}

		// Read entry type
		var entryType WALEntryType
		if err := binary.Read(w.file, binary.BigEndian, &entryType); err != nil {
			if err == io.EOF {
				break
			}
			return err
		}

		// Read page ID
		var pageID uint64
		if err := binary.Read(w.file, binary.BigEndian, &pageID); err != nil {
			if err == io.EOF {
				break
			}
			return err
		}

		// Read data length
		var dataLen uint32
		if err := binary.Read(w.file, binary.BigEndian, &dataLen); err != nil {
			if err == io.EOF {
				break
			}
			return err
		}

		// Skip data
		if _, err := w.file.Seek(int64(dataLen), io.SeekCurrent); err != nil {
			return err
		}
	}

	w.nextLSN = maxLSN + 1
	// Seek to end for appending
	_, err = w.file.Seek(0, io.SeekEnd)
	return err
}

// LogPageWrite logs a page write operation to the WAL
// Format: [LSN:8][EntryType:1][PageID:8][DataLength:4][PageData:4096]
func (w *WALManager) LogPageWrite(pageID uint64, pageObj interface{}, entryType WALEntryType) (uint64, error) {
	lsn := w.nextLSN
	w.nextLSN++

		// Serialize page
		buf := &bytes.Buffer{}
		switch p := pageObj.(type) {
		case *page.MetaPage:
			if err := p.WriteToBuffer(buf); err != nil {
				return 0, err
			}
		case *page.InternalPage:
			if err := p.WriteToBuffer(buf); err != nil {
				return 0, err
			}
		case *page.LeafPage:
			if err := p.WriteToBuffer(buf); err != nil {
				return 0, err
			}
		default:
			return 0, fmt.Errorf("unsupported page type for WAL: %T", pageObj)
		}

	// Pad to page size
	padding := make([]byte, w.pageSize-buf.Len())
	if _, err := buf.Write(padding); err != nil {
		return 0, err
	}

	entry := WALEntry{
		LSN:      lsn,
		Type:     entryType,
		PageID:   pageID,
		PageData: buf.Bytes(),
	}

	// Write entry to WAL
	if err := w.writeEntry(entry); err != nil {
		return 0, err
	}

	// Sync to ensure durability
	if err := w.file.Sync(); err != nil {
		return 0, fmt.Errorf("failed to sync WAL: %w", err)
	}

	return lsn, nil
}

// writeEntry writes a WAL entry to the file
// Format: [LSN:8][EntryType:1][PageID:8][DataLength:4][PageData:4096]
func (w *WALManager) writeEntry(entry WALEntry) error {
	// Write LSN
	if err := binary.Write(w.file, binary.BigEndian, entry.LSN); err != nil {
		return err
	}

	// Write entry type
	if err := binary.Write(w.file, binary.BigEndian, entry.Type); err != nil {
		return err
	}

	// Write page ID
	if err := binary.Write(w.file, binary.BigEndian, entry.PageID); err != nil {
		return err
	}

	// Write data length
	dataLen := uint32(len(entry.PageData))
	if err := binary.Write(w.file, binary.BigEndian, dataLen); err != nil {
		return err
	}

	// Write page data
	if _, err := w.file.Write(entry.PageData); err != nil {
		return err
	}

	return nil
}

// Checkpoint writes a checkpoint entry and truncates the WAL
func (w *WALManager) Checkpoint() error {
	lsn := w.nextLSN
	w.nextLSN++

	entry := WALEntry{
		LSN:      lsn,
		Type:     WALEntryCheckpoint,
		PageID:   0,
		PageData: nil,
	}

	if err := w.writeEntry(entry); err != nil {
		return err
	}

	if err := w.file.Sync(); err != nil {
		return err
	}

	// Truncate WAL file (in production, you'd archive old logs)
	// For simplicity, we truncate to 0 after checkpoint
	// In a real system, you'd keep multiple WAL segments
	if err := w.file.Truncate(0); err != nil {
		return err
	}

	_, err := w.file.Seek(0, io.SeekStart)
	w.nextLSN = 1
	return err
}

// Recover replays WAL entries to restore database state
func (w *WALManager) Recover(pm *page.PageManager) error {
	_, err := w.file.Seek(0, io.SeekStart)
	if err != nil {
		return err
	}

	for {
		var lsn uint64
		if err := binary.Read(w.file, binary.BigEndian, &lsn); err != nil {
			if err == io.EOF {
				break
			}
			return err
		}

		var entryType WALEntryType
		if err := binary.Read(w.file, binary.BigEndian, &entryType); err != nil {
			if err == io.EOF {
				break
			}
			return err
		}

		// Checkpoint marks end of recoverable entries
		if entryType == WALEntryCheckpoint {
			break
		}

		var pageID uint64
		if err := binary.Read(w.file, binary.BigEndian, &pageID); err != nil {
			if err == io.EOF {
				break
			}
			return err
		}

		var dataLen uint32
		if err := binary.Read(w.file, binary.BigEndian, &dataLen); err != nil {
			if err == io.EOF {
				break
			}
			return err
		}

		// Read page data
		pageData := make([]byte, dataLen)
		if _, err := io.ReadFull(w.file, pageData); err != nil {
			return err
		}

		// Deserialize and restore page
		r := bytes.NewReader(pageData)
		var hdr page.PageHeader
		if err := hdr.ReadFromBuffer(r); err != nil {
			return err
		}

		var pageObj interface{}
		switch hdr.PageType {
		case page.PageTypeMeta:
			m := &page.MetaPage{Header: hdr}
			if err := m.ReadFromBuffer(r); err != nil {
				return err
			}
			pageObj = m
		case page.PageTypeInternal:
			ip := &page.InternalPage{Header: hdr}
			if err := ip.ReadFromBuffer(r); err != nil {
				return err
			}
			pageObj = ip
		case page.PageTypeLeaf:
			lp := &page.LeafPage{Header: hdr}
			if err := lp.ReadFromBuffer(r); err != nil {
				return err
			}
			pageObj = lp
		default:
			return fmt.Errorf("unknown page type %d during recovery", hdr.PageType)
		}

		// Restore page to page manager cache
		pm.Put(pageID, pageObj)
		// Write to main database file
		if err := pm.WritePageToFile(pageID, pageObj); err != nil {
			return fmt.Errorf("failed to restore page %d: %w", pageID, err)
		}
	}

	return nil
}

// Close closes the WAL file
func (w *WALManager) Close() error {
	if w.file != nil {
		return w.file.Close()
	}
	return nil
}

// GetNextLSN returns the next LSN that will be assigned
func (w *WALManager) GetNextLSN() uint64 {
	return w.nextLSN
}
