package storage

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
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

// String returns the string representation of ColumnType
func (ct ColumnType) String() string {
	switch ct {
	case TypeInt:
		return "INT"
	case TypeString:
		return "STRING"
	case TypeFloat:
		return "FLOAT"
	case TypeBool:
		return "BOOL"
	default:
		return "UNKNOWN"
	}
}

// Column represents a single column value in a row
type Column struct {
	Type  ColumnType
	Value interface{} // int64, string, float64, or bool
}

// Record represents a database row with multiple columns
type Record struct {
	Columns []Column
}

// CompositeKey represents a primary key consisting of one or more column values
type CompositeKey struct {
	Values []Column
}

// -----------------------------
// Record Methods
// -----------------------------

// NewRecord creates a new Record with the given columns
func NewRecord(columns ...Column) Record {
	return Record{Columns: columns}
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

// Size returns the number of bytes needed to serialize this Record
func (r Record) Size() int {
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

// WriteTo serializes the Record to a writer
func (r Record) WriteTo(w io.Writer) error {
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

// ReadRecordFrom deserializes a Record from a reader
func ReadRecordFrom(r io.Reader) (Record, error) {
	var numCols uint32
	if err := binary.Read(r, binary.BigEndian, &numCols); err != nil {
		return Record{}, err
	}

	columns := make([]Column, numCols)
	for i := 0; i < int(numCols); i++ {
		var colType uint8
		if err := binary.Read(r, binary.BigEndian, &colType); err != nil {
			return Record{}, err
		}

		col := Column{Type: ColumnType(colType)}
		switch col.Type {
		case TypeInt:
			var val int64
			if err := binary.Read(r, binary.BigEndian, &val); err != nil {
				return Record{}, err
			}
			col.Value = val
		case TypeString:
			var length uint32
			if err := binary.Read(r, binary.BigEndian, &length); err != nil {
				return Record{}, err
			}
			buf := make([]byte, length)
			if _, err := io.ReadFull(r, buf); err != nil {
				return Record{}, err
			}
			col.Value = string(buf)
		case TypeFloat:
			var val float64
			if err := binary.Read(r, binary.BigEndian, &val); err != nil {
				return Record{}, err
			}
			col.Value = val
		case TypeBool:
			var val uint8
			if err := binary.Read(r, binary.BigEndian, &val); err != nil {
				return Record{}, err
			}
			col.Value = val == 1
		default:
			return Record{}, fmt.Errorf("unknown column type: %d", colType)
		}
		columns[i] = col
	}

	return Record{Columns: columns}, nil
}

// String returns a string representation of the Record
func (r Record) String() string {
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
	for i := 0; i < min(len(k.Values), len(other.Values)); i++ {
		cmp := compareColumns(k.Values[i], other.Values[i])
		if cmp != 0 {
			return cmp
		}
	}

	// if all compared columns are equal, compare lengths
	switch {
		case len(k.Values) < len(other.Values):
			return -1
		case len(k.Values) > len(other.Values):
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

	// write each value (same as Record columns)
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

// -----------------------------
// Schema Definitions
// -----------------------------

// ColumnDefinition represents a column definition in a table schema
type ColumnDefinition struct {
	Name string     // Column name
	Type ColumnType // Column data type (INT, STRING, etc.)
}

// Schema represents a table schema with column definitions and primary key columns
type Schema struct {
	Columns          []ColumnDefinition // All columns in the table
	PrimaryKeyColumns []string           // Ordered list of column names that form the primary key
}

// NewSchema creates a new Schema with the given columns and primary key columns
func NewSchema(columns []ColumnDefinition, primaryKeyColumns []string) (*Schema, error) {
	// Validate that all primary key columns exist in the columns list
	columnMap := make(map[string]ColumnDefinition)
	for _, col := range columns {
		columnMap[col.Name] = col
	}

	for _, pkCol := range primaryKeyColumns {
		if _, exists := columnMap[pkCol]; !exists {
			return nil, fmt.Errorf("primary key column '%s' not found in schema columns", pkCol)
		}
	}

	return &Schema{
		Columns:          columns,
		PrimaryKeyColumns: primaryKeyColumns,
	}, nil
}

// GetColumnDefinition returns the ColumnDefinition for a given column name
func (s *Schema) GetColumnDefinition(name string) (ColumnDefinition, bool) {
	for _, col := range s.Columns {
		if col.Name == name {
			return col, true
		}
	}
	return ColumnDefinition{}, false
}

// ValidateRow validates a raw JSON input (Row) against the schema
// Returns error if fields are missing, types don't match, or primary key columns are missing
func (s *Schema) ValidateRow(row map[string]interface{}) error {
	// Check that all schema columns exist in the row
	for _, colDef := range s.Columns {
		value, exists := row[colDef.Name]
		if !exists {
			return fmt.Errorf("missing required column: %s", colDef.Name)
		}

		// Validate type
		if err := validateValueType(value, colDef.Type); err != nil {
			return fmt.Errorf("column '%s': %w", colDef.Name, err)
		}
	}

	// Ensure all primary key columns are present
	for _, pkCol := range s.PrimaryKeyColumns {
		if _, exists := row[pkCol]; !exists {
			return fmt.Errorf("missing primary key column: %s", pkCol)
		}
	}

	return nil
}

// ValidateKey validates only the primary key columns from a partial row data
// This is used for Search and Delete operations where only key fields are provided
// Returns error if primary key columns are missing or types don't match
func (s *Schema) ValidateKey(keyData map[string]interface{}) error {
	// Validate that all primary key columns are present and have correct types
	for _, pkColName := range s.PrimaryKeyColumns {
		colDef, exists := s.GetColumnDefinition(pkColName)
		if !exists {
			return fmt.Errorf("primary key column '%s' not found in schema", pkColName)
		}

		value, exists := keyData[pkColName]
		if !exists {
			return fmt.Errorf("missing primary key column: %s", pkColName)
		}

		// Validate type
		if err := validateValueType(value, colDef.Type); err != nil {
			return fmt.Errorf("primary key column '%s': %w", pkColName, err)
		}
	}

	return nil
}

// validateValueType checks if a value matches the expected ColumnType
func validateValueType(value interface{}, expectedType ColumnType) error {
	switch expectedType {
	case TypeInt:
		// Accept int, int32, int64, float64 (if whole number), or json.Number
		switch v := value.(type) {
		case int:
			return nil
		case int32:
			return nil
		case int64:
			return nil
		case float64:
			// Check if it's a whole number
			if v == float64(int64(v)) {
				return nil
			}
			return fmt.Errorf("expected INT, got float64 with decimal part")
		case json.Number:
			// Try to parse as int64
			_, err := v.Int64()
			if err != nil {
				return fmt.Errorf("expected INT, got json.Number that cannot be parsed as int: %w", err)
			}
			return nil
		default:
			return fmt.Errorf("expected INT, got %T", value)
		}
	case TypeString:
		_, ok := value.(string)
		if !ok {
			return fmt.Errorf("expected STRING, got %T", value)
		}
		return nil
	case TypeFloat:
		switch value.(type) {
		case float32, float64, int, int32, int64:
			return nil
		case json.Number:
			// Try to parse as float64
			_, err := value.(json.Number).Float64()
			if err != nil {
				return fmt.Errorf("expected FLOAT, got json.Number that cannot be parsed as float: %w", err)
			}
			return nil
		default:
			return fmt.Errorf("expected FLOAT, got %T", value)
		}
	case TypeBool:
		_, ok := value.(bool)
		if !ok {
			return fmt.Errorf("expected BOOL, got %T", value)
		}
		return nil
	default:
		return fmt.Errorf("unknown column type: %d", expectedType)
	}
}

// ExtractKey constructs a CompositeKey from a row using the primary key columns in order
// Example: If Schema has columns [A, B, C] and PK is [C, A], input {A:1, B:2, C:3} generates Key [3, 1]
// This method validates the entire row (all columns) - use ExtractKeyFromKeyData for key-only validation
func (s *Schema) ExtractKey(row map[string]interface{}) (CompositeKey, error) {
	if err := s.ValidateRow(row); err != nil {
		return CompositeKey{}, fmt.Errorf("row validation failed: %w", err)
	}

	keyValues := make([]Column, 0, len(s.PrimaryKeyColumns))

	for _, pkColName := range s.PrimaryKeyColumns {
		colDef, exists := s.GetColumnDefinition(pkColName)
		if !exists {
			return CompositeKey{}, fmt.Errorf("primary key column '%s' not found in schema", pkColName)
		}

		value := row[pkColName]
		column, err := convertValueToColumn(value, colDef.Type)
		if err != nil {
			return CompositeKey{}, fmt.Errorf("failed to convert primary key column '%s': %w", pkColName, err)
		}

		keyValues = append(keyValues, column)
	}

	return CompositeKey{Values: keyValues}, nil
}

// ExtractKeyFromKeyData constructs a CompositeKey from partial key data (only primary key columns)
// This is used for Search and Delete operations where only key fields are provided
// Example: If Schema has PK [C, A], input {A:1, C:3} generates Key [3, 1]
// Non-key fields in keyData are ignored
func (s *Schema) ExtractKeyFromKeyData(keyData map[string]interface{}) (CompositeKey, error) {
	// Validate only primary key columns
	if err := s.ValidateKey(keyData); err != nil {
		return CompositeKey{}, fmt.Errorf("key validation failed: %w", err)
	}

	keyValues := make([]Column, 0, len(s.PrimaryKeyColumns))

	for _, pkColName := range s.PrimaryKeyColumns {
		colDef, exists := s.GetColumnDefinition(pkColName)
		if !exists {
			return CompositeKey{}, fmt.Errorf("primary key column '%s' not found in schema", pkColName)
		}

		value := keyData[pkColName]
		column, err := convertValueToColumn(value, colDef.Type)
		if err != nil {
			return CompositeKey{}, fmt.Errorf("failed to convert primary key column '%s': %w", pkColName, err)
		}

		keyValues = append(keyValues, column)
	}

	return CompositeKey{Values: keyValues}, nil
}

// convertValueToColumn converts a raw value to a Column with the specified type
func convertValueToColumn(value interface{}, colType ColumnType) (Column, error) {
	switch colType {
	case TypeInt:
		var intVal int64
		switch v := value.(type) {
		case int:
			intVal = int64(v)
		case int32:
			intVal = int64(v)
		case int64:
			intVal = v
		case float64:
			// Check if it's a whole number
			if v != float64(int64(v)) {
				return Column{}, fmt.Errorf("cannot convert float64 with decimal part to INT")
			}
			intVal = int64(v)
		case json.Number:
			var err error
			intVal, err = v.Int64()
			if err != nil {
				return Column{}, fmt.Errorf("cannot convert json.Number to int64: %w", err)
			}
		default:
			return Column{}, fmt.Errorf("cannot convert %T to INT", value)
		}
		return Column{Type: TypeInt, Value: intVal}, nil

	case TypeString:
		strVal, ok := value.(string)
		if !ok {
			return Column{}, fmt.Errorf("cannot convert %T to STRING", value)
		}
		return Column{Type: TypeString, Value: strVal}, nil

	case TypeFloat:
		var floatVal float64
		switch v := value.(type) {
		case float32:
			floatVal = float64(v)
		case float64:
			floatVal = v
		case int:
			floatVal = float64(v)
		case int32:
			floatVal = float64(v)
		case int64:
			floatVal = float64(v)
		case json.Number:
			var err error
			floatVal, err = v.Float64()
			if err != nil {
				return Column{}, fmt.Errorf("cannot convert json.Number to float64: %w", err)
			}
		default:
			return Column{}, fmt.Errorf("cannot convert %T to FLOAT", value)
		}
		return Column{Type: TypeFloat, Value: floatVal}, nil

	case TypeBool:
		boolVal, ok := value.(bool)
		if !ok {
			return Column{}, fmt.Errorf("cannot convert %T to BOOL", value)
		}
		return Column{Type: TypeBool, Value: boolVal}, nil

	default:
		return Column{}, fmt.Errorf("unknown column type: %d", colType)
	}
}

// RowToRecord converts a row (map[string]interface{}) to a Record based on the schema
// The record will contain columns in the same order as defined in the schema
func (s *Schema) RowToRecord(row map[string]interface{}) (Record, error) {
	if err := s.ValidateRow(row); err != nil {
		return Record{}, fmt.Errorf("row validation failed: %w", err)
	}

	columns := make([]Column, 0, len(s.Columns))
	for _, colDef := range s.Columns {
		value := row[colDef.Name]
		column, err := convertValueToColumn(value, colDef.Type)
		if err != nil {
			return Record{}, fmt.Errorf("failed to convert column '%s': %w", colDef.Name, err)
		}
		columns = append(columns, column)
	}

	return Record{Columns: columns}, nil
}
