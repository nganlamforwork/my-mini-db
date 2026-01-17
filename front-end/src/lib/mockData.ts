import type { TreeStructure, TreeNode, Record, CompositeKey } from '@/types/database';

// Create complex composite keys (multi-column keys)
const createCompositeKey = (...vals: Array<{ type: 'int' | 'string' | 'float' | 'bool', value: number | string | boolean }>): CompositeKey => ({
  values: vals.map(v => ({ type: v.type, value: v.value }))
});

// Create complex records with multiple column types
const createComplexRecord = (id: number, name: string, price: number, active: boolean): Record => ({
  columns: [
    { type: 'int', value: id },
    { type: 'string', value: name },
    { type: 'float', value: price },
    { type: 'bool', value: active }
  ]
});

export const getMockTree = (): TreeStructure => {
  const nodes: { [key: string]: TreeNode } = {};

  // Root (Internal) - uses composite keys with (id, category)
  nodes['2'] = {
    pageId: 2,
    type: 'internal',
    keys: [
      createCompositeKey({ type: 'int', value: 50 }, { type: 'string', value: 'B' }),
      createCompositeKey({ type: 'int', value: 100 }, { type: 'string', value: 'D' })
    ],
    children: [3, 4, 5]
  };

  // Level 1 - Internal nodes with composite keys
  nodes['3'] = {
    pageId: 3,
    type: 'internal',
    keys: [
      createCompositeKey({ type: 'int', value: 20 }, { type: 'string', value: 'A' }),
      createCompositeKey({ type: 'int', value: 35 }, { type: 'string', value: 'B' })
    ],
    children: [6, 7, 8]
  };

  nodes['4'] = {
    pageId: 4,
    type: 'internal',
    keys: [
      createCompositeKey({ type: 'int', value: 75 }, { type: 'string', value: 'C' })
    ],
    children: [9, 10]
  };

  nodes['5'] = {
    pageId: 5,
    type: 'internal',
    keys: [
      createCompositeKey({ type: 'int', value: 125 }, { type: 'string', value: 'E' })
    ],
    children: [11, 12]
  };

  // Level 2 - Leaf Nodes with complex keys and values
  const leaves = [
    {
      id: 6,
      keys: [
        { id: 10, category: 'A', name: 'Product A1', price: 99.99, active: true },
        { id: 15, category: 'A', name: 'Product A2', price: 149.50, active: true }
      ],
      parent: 3
    },
    {
      id: 7,
      keys: [
        { id: 20, category: 'B', name: 'Product B1', price: 199.99, active: true },
        { id: 25, category: 'B', name: 'Product B2', price: 249.99, active: false }
      ],
      parent: 3
    },
    {
      id: 8,
      keys: [
        { id: 35, category: 'B', name: 'Product B3', price: 299.99, active: true }
      ],
      parent: 3
    },
    {
      id: 9,
      keys: [
        { id: 50, category: 'C', name: 'Product C1', price: 399.99, active: true },
        { id: 60, category: 'C', name: 'Product C2', price: 449.99, active: true }
      ],
      parent: 4
    },
    {
      id: 10,
      keys: [
        { id: 75, category: 'C', name: 'Product C3', price: 499.99, active: false }
      ],
      parent: 4
    },
    {
      id: 11,
      keys: [
        { id: 100, category: 'D', name: 'Product D1', price: 599.99, active: true },
        { id: 110, category: 'D', name: 'Product D2', price: 649.99, active: true }
      ],
      parent: 5
    },
    {
      id: 12,
      keys: [
        { id: 125, category: 'E', name: 'Product E1', price: 799.99, active: true },
        { id: 130, category: 'E', name: 'Product E2', price: 849.99, active: true }
      ],
      parent: 5
    }
  ];

  leaves.forEach((leaf, idx) => {
    nodes[leaf.id.toString()] = {
      pageId: leaf.id,
      type: 'leaf',
      keys: leaf.keys.map(k => 
        createCompositeKey(
          { type: 'int', value: k.id },
          { type: 'string', value: k.category }
        )
      ),
      values: leaf.keys.map(k => createComplexRecord(k.id, k.name, k.price, k.active)),
      nextPage: idx < leaves.length - 1 ? leaves[idx + 1].id : undefined,
      prevPage: idx > 0 ? leaves[idx - 1].id : undefined
    };
  });

  return {
    rootPage: 2,
    height: 3,
    nodes
  };
};
