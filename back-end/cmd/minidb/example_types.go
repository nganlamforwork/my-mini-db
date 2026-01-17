package main

import (
	"fmt"

	"bplustree/internal/storage"
)

// Example: Using composite keys and structured rows
func ExampleCompositeKeyAndRecord() {
	// Create a composite key with (userID, timestamp)
	key1 := storage.NewCompositeKey(
		storage.NewInt(1001),      // userID
		storage.NewInt(1704067200), // timestamp
	)

	// Create a row with user data
	row1 := storage.NewRecord(
		storage.NewString("John Doe"),
		storage.NewInt(30),
		storage.NewString("john@example.com"),
		storage.NewBool(true), // is_active
	)

	fmt.Println("Key:", key1)
	fmt.Println("Record:", row1)

	// Create another composite key
	key2 := storage.NewCompositeKey(
		storage.NewInt(1001),
		storage.NewInt(1704070800),
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
	key := storage.NewCompositeKey(storage.NewInt(42))

	// Single column value (string)
	value := storage.NewRecord(storage.NewString("Hello, World!"))

	fmt.Println("Simple Key:", key)
	fmt.Println("Simple Value:", value)

	// Output:
	// Simple Key: (42)
	// Simple Value: {Hello, World!}
}

// Example: Using different column types
func ExampleMixedTypes() {
	// Key with mixed types (not recommended but supported)
	key := storage.NewCompositeKey(
		storage.NewInt(100),
		storage.NewString("A"),
	)

	// Record with different types
	row := storage.NewRecord(
		storage.NewString("Product Name"),
		storage.NewFloat(99.99),
		storage.NewInt(50), // quantity
		storage.NewBool(false), // discontinued
	)

	fmt.Printf("Key size: %d bytes\n", key.Size())
	fmt.Printf("Record size: %d bytes\n", row.Size())

	// Output:
	// Key size: 20 bytes
	// Record size: 36 bytes
}
