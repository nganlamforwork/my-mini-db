package main

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"io"
)

// ColumnType represents the data type of a column
type ColumnType int

const (
	TypeInt ColumnType = iota
	TypeString
	TypeFloat
	TypeBool
)

// Column represents a single column value in a row
type Column struct {
	Type  ColumnType
	Value interface{} // int64, string, float64, or bool
}

// Row represents a database row with multiple columns
type Row struct {
	Columns []Column
}

// CompositeKey represents a primary key consisting of one or more column values
type CompositeKey struct {
	Values []Column
}

// -----------------------------
// Row Methods
// -----------------------------

// NewRow creates a new Row with the given columns
func NewRow(columns ...Column) Row {
	return Row{Columns: columns}
}

// NewInt creates an integer column
func NewInt(val int64) Column {
	return Column{Type: TypeInt, Value: val}
}

// NewString creates a string column
func NewString(val string) Column {
	return Column{Type: TypeString, Value: val}
}

// NewFloat creates a float column
func NewFloat(val float64) Column {
	return Column{Type: TypeFloat, Value: val}
}

// NewBool creates a boolean column
func NewBool(val bool) Column {
	return Column{Type: TypeBool, Value: val}
}

// Size returns the number of bytes needed to serialize this Row
func (r Row) Size() int {
	size := 4 // uint32 for number of columns
	for _, col := range r.Columns {
		size += 1 // column type byte
		switch col.Type {
		case TypeInt:
			size += 8
		case TypeString:
			size += 4 + len(col.Value.(string)) // length prefix + bytes
		case TypeFloat:
			size += 8
		case TypeBool:
			size += 1
		}
	}
	return size
}

// WriteTo serializes the Row to a writer
func (r Row) WriteTo(w io.Writer) error {
	// write number of columns
	if err := binary.Write(w, binary.BigEndian, uint32(len(r.Columns))); err != nil {
		return err
	}

	// write each column
	for _, col := range r.Columns {
		// write column type
		if err := binary.Write(w, binary.BigEndian, uint8(col.Type)); err != nil {
			return err
		}

		// write column value based on type
		switch col.Type {
		case TypeInt:
			if err := binary.Write(w, binary.BigEndian, col.Value.(int64)); err != nil {
				return err
			}
		case TypeString:
			s := col.Value.(string)
			if err := binary.Write(w, binary.BigEndian, uint32(len(s))); err != nil {
				return err
			}
			if _, err := w.Write([]byte(s)); err != nil {
				return err
			}
		case TypeFloat:
			if err := binary.Write(w, binary.BigEndian, col.Value.(float64)); err != nil {
				return err
			}
		case TypeBool:
			val := uint8(0)
			if col.Value.(bool) {
				val = 1
			}
			if err := binary.Write(w, binary.BigEndian, val); err != nil {
				return err
			}
		}
	}
	return nil
}

// ReadRowFrom deserializes a Row from a reader
func ReadRowFrom(r io.Reader) (Row, error) {
	var numCols uint32
	if err := binary.Read(r, binary.BigEndian, &numCols); err != nil {
		return Row{}, err
	}

	columns := make([]Column, numCols)
	for i := 0; i < int(numCols); i++ {
		var colType uint8
		if err := binary.Read(r, binary.BigEndian, &colType); err != nil {
			return Row{}, err
		}

		col := Column{Type: ColumnType(colType)}
		switch col.Type {
		case TypeInt:
			var val int64
			if err := binary.Read(r, binary.BigEndian, &val); err != nil {
				return Row{}, err
			}
			col.Value = val
		case TypeString:
			var length uint32
			if err := binary.Read(r, binary.BigEndian, &length); err != nil {
				return Row{}, err
			}
			buf := make([]byte, length)
			if _, err := io.ReadFull(r, buf); err != nil {
				return Row{}, err
			}
			col.Value = string(buf)
		case TypeFloat:
			var val float64
			if err := binary.Read(r, binary.BigEndian, &val); err != nil {
				return Row{}, err
			}
			col.Value = val
		case TypeBool:
			var val uint8
			if err := binary.Read(r, binary.BigEndian, &val); err != nil {
				return Row{}, err
			}
			col.Value = val == 1
		default:
			return Row{}, fmt.Errorf("unknown column type: %d", colType)
		}
		columns[i] = col
	}

	return Row{Columns: columns}, nil
}

// String returns a string representation of the Row
func (r Row) String() string {
	var buf bytes.Buffer
	buf.WriteString("{")
	for i, col := range r.Columns {
		if i > 0 {
			buf.WriteString(", ")
		}
		buf.WriteString(fmt.Sprintf("%v", col.Value))
	}
	buf.WriteString("}")
	return buf.String()
}

// -----------------------------
// CompositeKey Methods
// -----------------------------

// NewCompositeKey creates a new CompositeKey with the given column values
func NewCompositeKey(columns ...Column) CompositeKey {
	return CompositeKey{Values: columns}
}

// Compare compares two CompositeKeys
// Returns: -1 if k < other, 0 if k == other, 1 if k > other
func (k CompositeKey) Compare(other CompositeKey) int {
	minLen := len(k.Values)
	if len(other.Values) < minLen {
		minLen = len(other.Values)
	}

	for i := 0; i < minLen; i++ {
		cmp := compareColumns(k.Values[i], other.Values[i])
		if cmp != 0 {
			return cmp
		}
	}

	// if all compared columns are equal, compare lengths
	if len(k.Values) < len(other.Values) {
		return -1
	} else if len(k.Values) > len(other.Values) {
		return 1
	}
	return 0
}

// compareColumns compares two columns of the same type
// Returns: -1 if a < b, 0 if a == b, 1 if a > b
func compareColumns(a, b Column) int {
	if a.Type != b.Type {
		// different types, compare by type order
		if a.Type < b.Type {
			return -1
		}
		return 1
	}

	switch a.Type {
	case TypeInt:
		aVal := a.Value.(int64)
		bVal := b.Value.(int64)
		if aVal < bVal {
			return -1
		} else if aVal > bVal {
			return 1
		}
		return 0
	case TypeString:
		aVal := a.Value.(string)
		bVal := b.Value.(string)
		if aVal < bVal {
			return -1
		} else if aVal > bVal {
			return 1
		}
		return 0
	case TypeFloat:
		aVal := a.Value.(float64)
		bVal := b.Value.(float64)
		if aVal < bVal {
			return -1
		} else if aVal > bVal {
			return 1
		}
		return 0
	case TypeBool:
		aVal := a.Value.(bool)
		bVal := b.Value.(bool)
		if !aVal && bVal {
			return -1
		} else if aVal && !bVal {
			return 1
		}
		return 0
	}
	return 0
}

// Size returns the number of bytes needed to serialize this CompositeKey
func (k CompositeKey) Size() int {
	size := 4 // uint32 for number of values
	for _, col := range k.Values {
		size += 1 // column type byte
		switch col.Type {
		case TypeInt:
			size += 8
		case TypeString:
			size += 4 + len(col.Value.(string))
		case TypeFloat:
			size += 8
		case TypeBool:
			size += 1
		}
	}
	return size
}

// WriteTo serializes the CompositeKey to a writer
func (k CompositeKey) WriteTo(w io.Writer) error {
	// write number of values
	if err := binary.Write(w, binary.BigEndian, uint32(len(k.Values))); err != nil {
		return err
	}

	// write each value (same as Row columns)
	for _, col := range k.Values {
		if err := binary.Write(w, binary.BigEndian, uint8(col.Type)); err != nil {
			return err
		}

		switch col.Type {
		case TypeInt:
			if err := binary.Write(w, binary.BigEndian, col.Value.(int64)); err != nil {
				return err
			}
		case TypeString:
			s := col.Value.(string)
			if err := binary.Write(w, binary.BigEndian, uint32(len(s))); err != nil {
				return err
			}
			if _, err := w.Write([]byte(s)); err != nil {
				return err
			}
		case TypeFloat:
			if err := binary.Write(w, binary.BigEndian, col.Value.(float64)); err != nil {
				return err
			}
		case TypeBool:
			val := uint8(0)
			if col.Value.(bool) {
				val = 1
			}
			if err := binary.Write(w, binary.BigEndian, val); err != nil {
				return err
			}
		}
	}
	return nil
}

// ReadCompositeKeyFrom deserializes a CompositeKey from a reader
func ReadCompositeKeyFrom(r io.Reader) (CompositeKey, error) {
	var numVals uint32
	if err := binary.Read(r, binary.BigEndian, &numVals); err != nil {
		return CompositeKey{}, err
	}

	values := make([]Column, numVals)
	for i := 0; i < int(numVals); i++ {
		var colType uint8
		if err := binary.Read(r, binary.BigEndian, &colType); err != nil {
			return CompositeKey{}, err
		}

		col := Column{Type: ColumnType(colType)}
		switch col.Type {
		case TypeInt:
			var val int64
			if err := binary.Read(r, binary.BigEndian, &val); err != nil {
				return CompositeKey{}, err
			}
			col.Value = val
		case TypeString:
			var length uint32
			if err := binary.Read(r, binary.BigEndian, &length); err != nil {
				return CompositeKey{}, err
			}
			buf := make([]byte, length)
			if _, err := io.ReadFull(r, buf); err != nil {
				return CompositeKey{}, err
			}
			col.Value = string(buf)
		case TypeFloat:
			var val float64
			if err := binary.Read(r, binary.BigEndian, &val); err != nil {
				return CompositeKey{}, err
			}
			col.Value = val
		case TypeBool:
			var val uint8
			if err := binary.Read(r, binary.BigEndian, &val); err != nil {
				return CompositeKey{}, err
			}
			col.Value = val == 1
		default:
			return CompositeKey{}, fmt.Errorf("unknown column type: %d", colType)
		}
		values[i] = col
	}

	return CompositeKey{Values: values}, nil
}

// String returns a string representation of the CompositeKey
func (k CompositeKey) String() string {
	var buf bytes.Buffer
	buf.WriteString("(")
	for i, col := range k.Values {
		if i > 0 {
			buf.WriteString(", ")
		}
		buf.WriteString(fmt.Sprintf("%v", col.Value))
	}
	buf.WriteString(")")
	return buf.String()
}
