#!/usr/bin/env python3
"""
B+Tree Visualization Tool

Reads binary database files from MiniDB and visualizes the tree structure as images.
This script parses the binary format directly without requiring Go code.
"""

import struct
import sys
import os
from typing import Dict, List, Optional, Tuple, Any

try:
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches
    from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False
    print("Warning: matplotlib not available. Install with: pip install matplotlib", file=sys.stderr)

# Constants matching Go code
# Header structure: PageID(8) + ParentPage(8) + PrevPage(8) + NextPage(8) + 
# PageType(1) + KeyCount(2) + FreeSpace(2) + Padding(4) + LSN(8) = 49 bytes
# But Go code uses PAGE_HEADER_SIZE = 56, so we'll use that for safety
PAGE_HEADER_SIZE = 56
# Actual serialized header size is 49 bytes, but meta data might be padded
# Meta data starts right after LSN (offset 49)
META_DATA_OFFSET = 49
DEFAULT_PAGE_SIZE = 4096

# Page types
PAGE_TYPE_META = 0
PAGE_TYPE_INTERNAL = 1
PAGE_TYPE_LEAF = 2

# Column types
COLUMN_TYPE_INT = 0
COLUMN_TYPE_STRING = 1
COLUMN_TYPE_FLOAT = 2
COLUMN_TYPE_BOOL = 3


class Column:
    def __init__(self, col_type: int, value: Any):
        self.type = col_type
        self.value = value

    def __str__(self):
        return str(self.value)


class CompositeKey:
    def __init__(self, values: List[Column]):
        self.values = values

    def __str__(self):
        return "(" + ", ".join(str(v) for v in self.values) + ")"


class Record:
    def __init__(self, columns: List[Column]):
        self.columns = columns

    def __str__(self):
        return "{" + ", ".join(str(c) for c in self.columns) + "}"


class PageHeader:
    def __init__(self, data: bytes):
        # Read header fields in big-endian format (matching Go binary.BigEndian)
        offset = 0
        self.page_id = struct.unpack('>Q', data[offset:offset+8])[0]
        offset += 8
        self.parent_page = struct.unpack('>Q', data[offset:offset+8])[0]
        offset += 8
        self.prev_page = struct.unpack('>Q', data[offset:offset+8])[0]
        offset += 8
        self.next_page = struct.unpack('>Q', data[offset:offset+8])[0]
        offset += 8
        self.page_type = struct.unpack('>B', data[offset:offset+1])[0]
        offset += 1
        self.key_count = struct.unpack('>H', data[offset:offset+2])[0]
        offset += 2
        self.free_space = struct.unpack('>H', data[offset:offset+2])[0]
        offset += 2
        # Skip padding (4 bytes)
        offset += 4
        self.lsn = struct.unpack('>Q', data[offset:offset+8])[0]


def read_column(data: bytes, offset: int) -> Tuple[Column, int]:
    """Read a column from data starting at offset. Returns (Column, new_offset)."""
    if offset + 1 > len(data):
        raise ValueError(f"Insufficient data to read column type at offset {offset}")
    
    col_type = struct.unpack('>B', data[offset:offset+1])[0]
    offset += 1

    if col_type == COLUMN_TYPE_INT:
        if offset + 8 > len(data):
            raise ValueError(f"Insufficient data to read int at offset {offset}")
        value = struct.unpack('>q', data[offset:offset+8])[0]
        offset += 8
    elif col_type == COLUMN_TYPE_STRING:
        if offset + 4 > len(data):
            raise ValueError(f"Insufficient data to read string length at offset {offset}")
        length = struct.unpack('>I', data[offset:offset+4])[0]
        offset += 4
        if offset + length > len(data):
            raise ValueError(f"Insufficient data to read string of length {length} at offset {offset}")
        value = data[offset:offset+length].decode('utf-8')
        offset += length
    elif col_type == COLUMN_TYPE_FLOAT:
        if offset + 8 > len(data):
            raise ValueError(f"Insufficient data to read float at offset {offset}")
        value = struct.unpack('>d', data[offset:offset+8])[0]
        offset += 8
    elif col_type == COLUMN_TYPE_BOOL:
        if offset + 1 > len(data):
            raise ValueError(f"Insufficient data to read bool at offset {offset}")
        value = struct.unpack('>B', data[offset:offset+1])[0] == 1
        offset += 1
    else:
        raise ValueError(f"Unknown column type: {col_type}")

    return Column(col_type, value), offset


def read_composite_key(data: bytes, offset: int) -> Tuple[CompositeKey, int]:
    """Read a CompositeKey from data starting at offset. Returns (CompositeKey, new_offset)."""
    num_values = struct.unpack('>I', data[offset:offset+4])[0]
    offset += 4

    values = []
    for _ in range(num_values):
        col, offset = read_column(data, offset)
        values.append(col)

    return CompositeKey(values), offset


def read_record(data: bytes, offset: int) -> Tuple[Record, int]:
    """Read a Record from data starting at offset. Returns (Record, new_offset)."""
    num_columns = struct.unpack('>I', data[offset:offset+4])[0]
    offset += 4

    columns = []
    for _ in range(num_columns):
        col, offset = read_column(data, offset)
        columns.append(col)

    return Record(columns), offset


class MetaPage:
    def __init__(self, header: PageHeader, data: bytes, offset: int):
        self.header = header
        # Meta data starts at offset 49 (after 8+8+8+8+1+2+2+4+8 = 49 bytes)
        # But we use the provided offset for flexibility
        self.root_page = struct.unpack('>Q', data[offset:offset+8])[0]
        offset += 8
        self.page_size = struct.unpack('>I', data[offset:offset+4])[0]
        offset += 4
        self.order = struct.unpack('>H', data[offset:offset+2])[0]
        offset += 2
        self.version = struct.unpack('>H', data[offset:offset+2])[0]


class InternalPage:
    def __init__(self, header: PageHeader, data: bytes, offset: int):
        self.header = header
        self.keys = []
        self.children = []

        # Read keys
        for _ in range(header.key_count):
            key, offset = read_composite_key(data, offset)
            self.keys.append(key)

        # Read children (key_count + 1)
        for _ in range(header.key_count + 1):
            child_id = struct.unpack('>Q', data[offset:offset+8])[0]
            offset += 8
            self.children.append(child_id)


class LeafPage:
    def __init__(self, header: PageHeader, data: bytes, offset: int):
        self.header = header
        self.keys = []
        self.values = []

        # Read keys
        for _ in range(header.key_count):
            key, offset = read_composite_key(data, offset)
            self.keys.append(key)

        # Read values
        for _ in range(header.key_count):
            value, offset = read_record(data, offset)
            self.values.append(value)


def read_page(file, page_id: int, page_size: int) -> Optional[Any]:
    """Read a page from the file. Returns MetaPage, InternalPage, LeafPage, or None."""
    offset = (page_id - 1) * page_size
    file.seek(offset)
    data = file.read(page_size)

    if len(data) < PAGE_HEADER_SIZE:
        return None

    try:
        # Header is actually 49 bytes: 8+8+8+8+1+2+2+4+8
        # But we read the first 56 bytes to be safe (includes some padding)
        header_data = data[:49]  # Actual header size
        if len(header_data) < 49:
            return None
        header = PageHeader(header_data)
        
        # All payload data starts at offset 49 (right after the 49-byte header)
        # The header is: PageID(8) + ParentPage(8) + PrevPage(8) + NextPage(8) + 
        # PageType(1) + KeyCount(2) + FreeSpace(2) + Padding(4) + LSN(8) = 49 bytes
        payload_offset = 49
        if header.page_type == PAGE_TYPE_META:
            return MetaPage(header, data, payload_offset)
        elif header.page_type == PAGE_TYPE_INTERNAL:
            return InternalPage(header, data, payload_offset)
        elif header.page_type == PAGE_TYPE_LEAF:
            return LeafPage(header, data, payload_offset)
        else:
            return None
    except (struct.error, ValueError, IndexError) as e:
        # If we can't parse the page, it might be empty or invalid
        return None


def build_tree_structure(file_path: str) -> Tuple[Dict[int, Any], Optional[int]]:
    """Read all pages from the file and build a tree structure."""
    pages = {}
    root_id = None

    with open(file_path, 'rb') as f:
        # Read meta page first
        meta = read_page(f, 1, DEFAULT_PAGE_SIZE)
        if meta and isinstance(meta, MetaPage):
            pages[1] = meta
            root_id = meta.root_page

        # Read all other pages
        f.seek(0, 2)  # Seek to end
        file_size = f.tell()
        num_pages = file_size // DEFAULT_PAGE_SIZE

        for page_id in range(2, num_pages + 1):
            page = read_page(f, page_id, DEFAULT_PAGE_SIZE)
            if page:
                pages[page_id] = page

    return pages, root_id


def visualize_tree(pages: Dict[int, Any], root_id: Optional[int], output_file: str):
    """Visualize the B+Tree structure and write to output file as an image."""
    if not HAS_MATPLOTLIB:
        # Fallback to text output if matplotlib is not available
        visualize_tree_text(pages, root_id, output_file)
        return
    
    # Determine output format from file extension
    output_ext = os.path.splitext(output_file)[1].lower()
    if output_ext not in ['.png', '.jpg', '.jpeg', '.pdf', '.svg']:
        # Default to PNG if no image extension
        output_file = os.path.splitext(output_file)[0] + '.png'
    
    meta = pages.get(1)
    if root_id is None or root_id == 0:
        # Empty tree
        fig, ax = plt.subplots(figsize=(10, 6))
        ax.text(0.5, 0.5, 'Empty Tree', ha='center', va='center', fontsize=20)
        ax.axis('off')
        plt.tight_layout()
        plt.savefig(output_file, dpi=150, bbox_inches='tight')
        plt.close()
        return
    
    # Build tree layout using a better algorithm
    node_positions = {}
    node_levels = {}
    max_level = 0
    x_positions = {}  # Track x positions for each level
    
    def get_level_width(level: int) -> int:
        """Count nodes at a given level."""
        count = 0
        for node_id, page in pages.items():
            if node_id == 1:  # Skip meta page
                continue
            if node_id in node_levels and node_levels[node_id] == level:
                count += 1
        return count
    
    def calculate_layout(node_id: int, level: int):
        """Calculate layout recursively."""
        nonlocal max_level
        if node_id == 0 or node_id not in pages:
            return
        
        page = pages[node_id]
        node_levels[node_id] = level
        max_level = max(max_level, level)
        
        if isinstance(page, InternalPage):
            # First, layout all children
            for child_id in page.children:
                calculate_layout(child_id, level + 1)
            
            # Position this node in the middle of its children
            if page.children:
                child_positions = [node_positions.get(cid, (0, 0))[0] 
                                  for cid in page.children if cid in node_positions]
                if child_positions:
                    node_x = sum(child_positions) / len(child_positions)
                else:
                    node_x = 0
            else:
                node_x = 0
        elif isinstance(page, LeafPage):
            # Leaf nodes: use sequential positioning based on key order
            # For now, use a simple counter
            if level not in x_positions:
                x_positions[level] = 0
            node_x = x_positions[level]
            x_positions[level] += 2.0
        
        node_positions[node_id] = (node_x, -level)
    
    # Calculate layout starting from root
    calculate_layout(root_id, 0)
    
    # Normalize and spread out positions
    if node_positions:
        # Group by level and normalize
        level_groups = {}
        for node_id, (x, y) in node_positions.items():
            level = int(-y)
            if level not in level_groups:
                level_groups[level] = []
            level_groups[level].append((node_id, x))
        
        # Normalize each level
        for level, nodes in level_groups.items():
            if len(nodes) > 1:
                xs = [x for _, x in nodes]
                min_x, max_x = min(xs), max(xs)
                if max_x > min_x:
                    for node_id, x in nodes:
                        normalized_x = (x - min_x) / (max_x - min_x) * 9 + 0.5
                        node_positions[node_id] = (normalized_x, -level)
                else:
                    # Spread evenly if all same x
                    spacing = 9.0 / len(nodes)
                    for i, (node_id, _) in enumerate(nodes):
                        node_positions[node_id] = (0.5 + i * spacing, -level)
            else:
                # Single node at level, center it
                node_id, _ = nodes[0]
                node_positions[node_id] = (5.0, -level)
    
    # Create figure with better sizing
    fig_width = 16
    fig_height = max(10, (max_level + 1) * 2.5)
    fig, ax = plt.subplots(figsize=(fig_width, fig_height))
    ax.set_xlim(0, 10)
    ax.set_ylim(-max_level - 1.5, 1.2)
    ax.axis('off')
    ax.set_facecolor('#FAFAFA')
    
    # Draw edges first
    for node_id, (x, y) in node_positions.items():
        page = pages[node_id]
        if isinstance(page, InternalPage):
            for child_id in page.children:
                if child_id in node_positions:
                    child_x, child_y = node_positions[child_id]
                    ax.plot([x, child_x], [y, child_y], 'k-', linewidth=1.5, alpha=0.6, zorder=1)
    
    # Draw nodes
    for node_id, (x, y) in node_positions.items():
        page = pages[node_id]
        
        if isinstance(page, InternalPage):
            # Internal node - blue box
            keys_str = ", ".join(str(k) for k in page.keys)
            if len(keys_str) > 40:
                keys_str = keys_str[:37] + "..."
            label = f"Page {node_id}\n[INTERNAL]\nKeys: {keys_str}"
            # Adjust box size based on content
            box_width = min(1.2, max(0.8, len(keys_str) * 0.08))
            box_height = 0.4
            box = FancyBboxPatch((x-box_width/2, y-box_height/2), box_width, box_height, 
                                boxstyle="round,pad=0.08", 
                                facecolor='#E3F2FD', edgecolor='#1976D2', linewidth=2.5)
            ax.add_patch(box)
            ax.text(x, y, label, ha='center', va='center', fontsize=9, weight='bold', 
                   family='monospace')
        
        elif isinstance(page, LeafPage):
            # Leaf node - green box
            keys_str = ", ".join(str(k) for k in page.keys[:4])  # Show first 4 keys
            if len(page.keys) > 4:
                keys_str += f" ... ({len(page.keys)} total)"
            values_str = ", ".join(str(v) for v in page.values[:3])  # Show first 3 values
            if len(page.values) > 3:
                values_str += f" ... ({len(page.values)} total)"
            
            # Truncate long strings
            if len(keys_str) > 50:
                keys_str = keys_str[:47] + "..."
            if len(values_str) > 50:
                values_str = values_str[:47] + "..."
            
            label = f"Page {node_id} [LEAF]\nKeys: {keys_str}\nValues: {values_str}"
            box_width = min(1.4, max(1.0, max(len(keys_str), len(values_str)) * 0.08))
            box_height = 0.5
            box = FancyBboxPatch((x-box_width/2, y-box_height/2), box_width, box_height, 
                                boxstyle="round,pad=0.08", 
                                facecolor='#E8F5E9', edgecolor='#388E3C', linewidth=2.5)
            ax.add_patch(box)
            ax.text(x, y, label, ha='center', va='center', fontsize=8, weight='bold',
                   family='monospace')
    
    # Add title
    title = "B+Tree Visualization"
    if meta and isinstance(meta, MetaPage):
        title += f"\nRoot={meta.root_page}, Order={meta.order}, PageSize={meta.page_size}"
    ax.text(5, 0.8, title, ha='center', va='center', fontsize=14, weight='bold')
    
    plt.tight_layout()
    plt.savefig(output_file, dpi=150, bbox_inches='tight')
    plt.close()


def visualize_tree_text(pages: Dict[int, Any], root_id: Optional[int], output_file: str):
    """Fallback text visualization if matplotlib is not available."""
    with open(output_file, 'w') as f:
        meta = pages.get(1)
        if meta and isinstance(meta, MetaPage):
            f.write("B+Tree Visualization\n")
            f.write(f"Meta: root={meta.root_page} order={meta.order} "
                   f"pageSize={meta.page_size} version={meta.version}\n\n")

        if root_id is None or root_id == 0:
            f.write("(Empty tree)\n")
            return

        def print_node(node_id: int, prefix: str, is_last: bool, is_root: bool = False):
            if node_id == 0 or node_id not in pages:
                return
            page = pages[node_id]
            connector = "`-- " if (is_last and not is_root) else "+-- " if not is_root else ""
            next_prefix = prefix + ("    " if is_last else "|   ")

            if isinstance(page, InternalPage):
                keys_str = "[" + ", ".join(str(k) for k in page.keys) + "]"
                children_str = "[" + ", ".join(str(c) for c in page.children) + "]"
                f.write(f"{prefix}{connector}[I {node_id}] keys {keys_str} "
                       f"children={children_str}\n")
                for i, child_id in enumerate(page.children):
                    is_last_child = (i == len(page.children) - 1)
                    print_node(child_id, next_prefix, is_last_child)
            elif isinstance(page, LeafPage):
                keys_str = "[" + ", ".join(str(k) for k in page.keys) + "]"
                values_str = "[" + ", ".join(str(v) for v in page.values) + "]"
                f.write(f"{prefix}{connector}[L {node_id}] keys {keys_str} "
                       f"values {values_str}\n")

        print_node(root_id, "", True, is_root=True)


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 visualize_tree.py <database_file.db> [output_file.png]")
        sys.exit(1)

    db_file = sys.argv[1]
    if not os.path.exists(db_file):
        print(f"Error: Database file '{db_file}' not found")
        sys.exit(1)

    output_file = sys.argv[2] if len(sys.argv) > 2 else db_file + ".png"

    try:
        pages, root_id = build_tree_structure(db_file)
        visualize_tree(pages, root_id, output_file)
        print(f"Tree visualization written to: {output_file}")
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
