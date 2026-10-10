import React, { useState, useCallback } from 'react';
import { FolderOpen, ChevronRight } from 'lucide-react';

/* Flatten the tree into a renderable list to avoid recursive JSX (babel-metadata-plugin crash) */
function flattenTree(nodes, depth, expandedSet) {
  const result = [];
  if (!nodes) return result;
  for (const node of nodes) {
    const hasKids = node.children && node.children.length > 0;
    const isExpanded = expandedSet.has(node.folder_id);
    result.push({ ...node, depth, hasKids, isExpanded });
    if (hasKids && isExpanded) {
      result.push(...flattenTree(node.children, depth + 1, expandedSet));
    }
  }
  return result;
}

export function WpTreeNode({ tree, onOpen, activeId }) {
  const [expanded, setExpanded] = useState(() => {
    const set = new Set();
    if (tree) tree.forEach(n => set.add(n.folder_id));
    return set;
  });

  const toggle = useCallback((folderId) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId); else next.add(folderId);
      return next;
    });
  }, []);

  const flat = flattenTree(tree, 0, expanded);

  return (
    <div data-testid="wp-tree">
      {flat.map(node => {
        const isActive = activeId === node.folder_id;
        return (
          <div key={node.folder_id} style={{ paddingLeft: node.depth * 12 }}
            className={`flex items-center gap-1 py-1 px-1.5 rounded-md cursor-pointer text-xs ${isActive ? 'bg-blue-50 text-[#1B2A4A] font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}>
            {node.hasKids ? (
              <button onClick={(e) => { e.stopPropagation(); toggle(node.folder_id); }} className="w-4 h-4 flex items-center justify-center">
                <ChevronRight className={`w-3 h-3 transition-transform ${node.isExpanded ? 'rotate-90' : ''}`} />
              </button>
            ) : <span className="w-4" />}
            <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="truncate flex-1" onClick={() => onOpen(node.folder_id)}>{node.name}</span>
          </div>
        );
      })}
    </div>
  );
}
