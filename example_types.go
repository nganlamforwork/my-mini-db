package main

import "fmt"

// Example: Using composite keys and structured rows
func ExampleCompositeKeyAndRecord() {
	// Create a composite key with (userID, timestamp)
	key1 := NewCompositeKey(
		NewInt(1001),      // userID
		NewInt(1704067200), // timestamp
	)

	// Create a row with user data
	row1 := NewRecord(
		NewString("John Doe"),
		NewInt(30),
		NewString("john@example.com"),
		NewBool(true), // is_active
	)

	fmt.Println("Key:", key1)
	fmt.Println("Record:", row1)

	// Create another composite key
	key2 := NewCompositeKey(
		NewInt(1001),
		NewInt(1704070800),
	)

	// Compare keys (lexicographic order)
	comparison := key1.Compare(key2)
	if comparison < 0 {
		fmt.Println("key1 < key2")
	} else if comparison > 0 {
		fmt.Println("key1 > key2")
	} else {
		fmt.Println("key1 == key2")
	}

	// Output:
	// Key: (1001, 1704067200)
	// Record: {John Doe, 30, john@example.com, true}
	// key1 < key2
}

// Example: Simple single-column usage (backward compatible pattern)
func ExampleSimpleKeyValue() {
	// Single column key (integer)
	key := NewCompositeKey(NewInt(42))

	// Single column value (string)
	value := NewRecord(NewString("Hello, World!"))

	fmt.Println("Simple Key:", key)
	fmt.Println("Simple Value:", value)

	// Output:
	// Simple Key: (42)
	// Simple Value: {Hello, World!}
}

// Example: Using different column types
func ExampleMixedTypes() {
	// Key with mixed types (not recommended but supported)
	key := NewCompositeKey(
		NewInt(100),
		NewString("A"),
	)

	// Record with different types
	row := NewRecord(
		NewString("Product Name"),
		NewFloat(99.99),
		NewInt(50), // quantity
		NewBool(false), // discontinued
	)

	fmt.Printf("Key size: %d bytes\n", key.Size())
	fmt.Printf("Record size: %d bytes\n", row.Size())

	// Output:
	// Key size: 20 bytes
	// Record size: 36 bytes
}
