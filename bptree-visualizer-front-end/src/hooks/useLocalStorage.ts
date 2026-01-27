import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Custom hook for managing state persisted in localStorage
 * Handles SSR safety and hydration mismatch by deferring localStorage read until client mount
 * 
 * @param key - localStorage key
 * @param initialValue - Default value if key doesn't exist in localStorage
 * @returns [storedValue, setValue] - Current value and setter function
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  // Store initialValue in a ref to prevent re-initialization on every render
  const initialValueRef = useRef(initialValue)
  
  // State to store our value
  // Initialize with initialValue to avoid hydration mismatch
  const [storedValue, setStoredValue] = useState<T>(initialValue)
  
  // Track if we've mounted (client-side)
  const [isMounted, setIsMounted] = useState(false)
  
  // Track if we've initialized from localStorage to prevent re-initialization
  const hasInitializedRef = useRef(false)

  // Initialize from localStorage after mount (client-side only)
  // Only run once on mount, not when initialValue changes
  useEffect(() => {
    // Prevent re-initialization if already done
    if (hasInitializedRef.current) {
      return
    }
    
    setIsMounted(true)
    hasInitializedRef.current = true
    
    try {
      // Check if window is defined (SSR safety)
      if (typeof window === 'undefined') {
        return
      }

      // Get from local storage by key
      const item = window.localStorage.getItem(key)
      
      // Parse stored json or return initialValue
      if (item) {
        try {
          const parsed = JSON.parse(item)
          setStoredValue(parsed)
        } catch (error) {
          // If parsing fails, use initialValue
          console.warn(`Failed to parse localStorage value for key "${key}":`, error)
          setStoredValue(initialValueRef.current)
        }
      }
    } catch (error) {
      // If error also return initialValue
      console.error(`Error reading localStorage key "${key}":`, error)
      setStoredValue(initialValueRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]) // Only depend on key, not initialValue

  // Return a wrapped version of useState's setter function that
  // persists the new value to localStorage.
  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have the same API as useState
      // Use functional update to get current value
      setStoredValue((prevValue) => {
        const valueToStore = value instanceof Function ? value(prevValue) : value
        
        // Save to local storage
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(key, JSON.stringify(valueToStore))
          } catch (error) {
            console.error(`Error setting localStorage key "${key}":`, error)
          }
        }
        
        return valueToStore
      })
    } catch (error) {
      // A more advanced implementation would handle the error case
      console.error(`Error setting localStorage key "${key}":`, error)
    }
  }, [key]) // Only depend on key, not storedValue

  // Return initialValue during SSR/hydration, then switch to storedValue after mount
  return [isMounted ? storedValue : initialValueRef.current, setValue]
}
