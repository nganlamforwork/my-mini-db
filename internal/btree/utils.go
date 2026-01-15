package btree

// BinarySearch finds the index of the target key in a sorted slice of keys.
// Returns the index if found, or -1 if not found.
//
// Algorithm: Standard binary search on sorted array.
//
// Return: int - index of key if found, -1 if not found
func BinarySearch(keys []KeyType, target KeyType) int {
	left, right := 0, len(keys)-1

	for left <= right {
		mid := (left + right) / 2
		cmp := keys[mid].Compare(target)

		if cmp == 0 {
			return mid // Found exact match
		} else if cmp < 0 {
			left = mid + 1 // Search right half
		} else {
			right = mid - 1 // Search left half
		}
	}

	return -1 // Not found
}

// BinarySearchLastLessOrEqual finds the index of the last key that is <= target key.
// This is used for internal node traversal to determine which child to follow.
// Returns -1 if all keys are greater than target (should follow leftmost child).
//
// Algorithm: Binary search that finds the rightmost position where key <= target.
//
// Return: int - index of last key <= target, or -1 if all keys > target
func BinarySearchLastLessOrEqual(keys []KeyType, target KeyType) int {
	left, right := 0, len(keys)-1
	pos := -1

	for left <= right {
		mid := (left + right) / 2
		if keys[mid].Compare(target) <= 0 {
			pos = mid
			left = mid + 1 // Continue searching right for last position
		} else {
			right = mid - 1 // Search left
		}
	}

	return pos
}

// BinarySearchFirstGreaterOrEqual finds the index of the first key that is >= target key.
// This is useful for range queries to find the starting position.
//
// Algorithm: Binary search that finds the leftmost position where key >= target.
//
// Return: int - index of first key >= target, or len(keys) if all keys < target
func BinarySearchFirstGreaterOrEqual(keys []KeyType, target KeyType) int {
	left, right := 0, len(keys)-1
	pos := len(keys) // Default: all keys are less than target

	for left <= right {
		mid := (left + right) / 2
		if keys[mid].Compare(target) >= 0 {
			pos = mid
			right = mid - 1 // Continue searching left for first position
		} else {
			left = mid + 1 // Search right
		}
	}

	return pos
}

// BinarySearchInsertPosition finds the position where a key should be inserted
// to maintain sorted order. Returns the index where the key should be inserted.
//
// Algorithm: Binary search that finds the leftmost position where key >= target.
//
// Return: int - index where key should be inserted to maintain sorted order
func BinarySearchInsertPosition(keys []KeyType, target KeyType) int {
	left, right := 0, len(keys)-1
	pos := len(keys) // Default: insert at end

	for left <= right {
		mid := (left + right) / 2
		if keys[mid].Compare(target) >= 0 {
			pos = mid
			right = mid - 1 // Continue searching left for first position
		} else {
			left = mid + 1 // Search right
		}
	}

	return pos
}
