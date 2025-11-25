import React from 'react';
import { createRoot } from 'react-dom/client';
import { UncontrolledTreeEnvironment, Tree, StaticTreeDataProvider } from 'react-complex-tree';
import { Folder, FolderOpen, File, Box, Package, Plus } from 'lucide-react';
import studioApp from './studioApp.js';

const items = {
  root: { index: 'root', isFolder: true, children: ['Workspace', 'Players', 'Lighting', 'ReplicatedStorage', 'ReplicatedFirst', 'ServerScriptService', 'ServerStorage', 'StarterGui', 'StarterPack', 'Teams', 'SoundService', 'Chat'], data: 'Game' },
  Workspace: { index: 'Workspace', isFolder: true, children: [], data: 'Workspace' },
  Players: { index: 'Players', isFolder: true, children: [], data: 'Players' },
  Lighting: { index: 'Lighting', isFolder: true, children: [], data: 'Lighting' },
  ReplicatedStorage: { index: 'ReplicatedStorage', isFolder: true, children: [], data: 'ReplicatedStorage' },
  ReplicatedFirst: { index: 'ReplicatedFirst', isFolder: true, children: [], data: 'ReplicatedFirst' },
  ServerScriptService: { index: 'ServerScriptService', isFolder: true, children: [], data: 'ServerScriptService' },
  ServerStorage: { index: 'ServerStorage', isFolder: true, children: [], data: 'ServerStorage' },
  StarterGui: { index: 'StarterGui', isFolder: true, children: [], data: 'StarterGui' },
  StarterPack: { index: 'StarterPack', isFolder: true, children: [], data: 'StarterPack' },
  Teams: { index: 'Teams', isFolder: true, children: [], data: 'Teams' },
  SoundService: { index: 'SoundService', isFolder: true, children: [], data: 'SoundService' },
  Chat: { index: 'Chat', isFolder: true, children: [], data: 'Chat' },
};

studioApp.treeItems = items;

function ExplorerTree() {
  const [treeItems, setTreeItems] = React.useState(items);
  const dataProvider = React.useMemo(() => new StaticTreeDataProvider(treeItems), [treeItems]);
  const lastFocusedItemRef = React.useRef(null);
  const [menuState, setMenuState] = React.useState({ visible: false, x: 0, y: 0 });
  const [viewState, setViewState] = React.useState({ 'explorer-tree': { expandedItems: ['Workspace'] } });

  React.useEffect(() => {
    const handleSceneCleared = () => {
        setTreeItems(p => {
            const workspace = p['Workspace'];
            if (!workspace) return p;
            
            // Create a new state object, keeping only non-part items
            const newItems = { ...items }; // Start with base items
            newItems['Workspace'] = { ...workspace, children: [] };
            return newItems;
        });
        setViewState(v => ({ ...v, 'explorer-tree': { expandedItems: ['Workspace'], focusedItem: 'Workspace' } }));
    };

    const handleObjectAdded = (object) => {
        const key = object.name;
        setTreeItems(p => {
            if (p[key]) return p; // Already exists
            const nx = { ...p };
            nx[key] = { index: key, isFolder: false, data: key, kind: object.userData.type };
            
            const parentKey = 'Workspace';
            const par = { ...(nx[parentKey] || { index: parentKey, isFolder: true, children: [], data: parentKey }) };
            par.children = [...(par.children || []), key];
            nx[parentKey] = par;
            
            return nx;
        });
        setViewState(v => {
            const s = v['explorer-tree'] || {};
            const ex = new Set(s.expandedItems || []);
            ex.add('Workspace');
            return { ...v, 'explorer-tree': { ...s, expandedItems: [...ex], focusedItem: key } };
        });
    };
    
    const handleScriptAdded = ({ name, parentName }) => {
        setTreeItems(p => {
            if (p[name]) return p;
            const key = name;
            const parentKey = parentName || 'Workspace';
            
            const nx = { ...p };
            nx[key] = { index: key, isFolder: false, data: key, kind: 'Script' };
            
            const par = { ...(nx[parentKey] || { index: parentKey, isFolder: true, children: [], data: parentKey }) };
            par.children = [...(par.children || []), key];
            nx[parentKey] = par;
            
            return nx;
        });
         setViewState(v => {
            const s = v['explorer-tree'] || {};
            const ex = new Set(s.expandedItems || []);
            ex.add(parentName || 'Workspace');
            return { ...v, 'explorer-tree': { ...s, expandedItems: [...ex], focusedItem: name } };
        });
    };

    studioApp.on('objectAdded', handleObjectAdded);
    studioApp.on('sceneCleared', handleSceneCleared);
    studioApp.on('scriptAdded', handleScriptAdded);

    // This is a pseudo-cleanup, as studioApp.off is not implemented.
    // In a real app, you'd have an `off` method to remove the listener.
    return () => {}; 
  }, []);

  React.useEffect(() => {
    studioApp.treeItems = treeItems;
  }, [treeItems]);

  const handleFocusItem = (item) => {
    lastFocusedItemRef.current = item;
    if (item?.kind === 'Script') { 
      window.studioApp?.openScript(item.index); 
      return; 
    }
    if (window.studioApp && window.studioApp.selectObjectByName) {
      if (!item.isFolder || item.index === 'Workspace') {
         window.studioApp.selectObjectByName(item.index);
      } else {
         window.studioApp.selectObjectByName(null); // Deselect if a folder is clicked
      }
    }
  };

  const handleContextMenu = (e) => { e.preventDefault(); setMenuState({ visible: true, x: e.clientX, y: e.clientY }); };
  const hideMenu = () => setMenuState(s => ({ ...s, visible: false }));
  const findParentKey = (child) => Object.values(treeItems).find(n => n.children?.includes(child))?.index || 'Workspace';
  const uniqueName = (base, parent) => { const keys=new Set(Object.keys(treeItems)); let n=base,i=2; while(keys.has(n)) n=base+' '+i++; return n; };
  const createChild = (type) => { const f=lastFocusedItemRef.current; const parent=f?(f.isFolder?f.index:findParentKey(f.index)):'Workspace'; const key=uniqueName(type,parent); if (type === 'Part') { studioApp.createObject({ type: 'Part', name: key }); hideMenu(); return; } setTreeItems(p=>{ const nx={...p}; nx[key]={index:key,isFolder:type==='Folder',children:(type==='Folder')?[]:undefined,data:key,kind:type}; const par={...(nx[parent]||{index:parent,isFolder:true,children:[],data:parent})}; par.isFolder=true; par.children=[...(par.children||[]),key]; nx[parent]=par; return nx;}); setViewState(v=>{ const s=v['explorer-tree']||{}; const ex=new Set(s.expandedItems||[]); ex.add(parent); return {...v,'explorer-tree':{...s,expandedItems:[...ex],focusedItem:key}}}); if(type==='Script'){ window.studioApp?.createScript(key); window.studioApp?.openScript(key); } hideMenu(); };

  React.useEffect(() => {
    if (!menuState.visible) return;
    const close = () => hideMenu();
    window.addEventListener('click', close);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('click', close); window.removeEventListener('resize', close); };
  }, [menuState.visible]);

  return React.createElement('div',{onContextMenu:handleContextMenu,style:{height:'100%'}},
    React.createElement(UncontrolledTreeEnvironment,{
      key: Object.keys(treeItems).join('|'),
      dataProvider,
      getItemTitle: item => item.data,
      onFocusItem: handleFocusItem,
      renderItemTitle: ({ title, item, context }) => {
        const isFolder = item.isFolder || ['Workspace', 'Lighting', 'Players', 'ReplicatedStorage', 'ServerScriptService', 'ServerStorage', 'StarterGui', 'StarterPack', 'Teams', 'SoundService', 'Chat', 'ReplicatedFirst'].includes(item.index);

        const iconEl = (() => {
          // Specific item overrides by index
          switch (item.index) {
            case 'Workspace': return React.createElement('img', { src: '/folder_type_Workspace-light.png', className: 'tree-icon' });
            case 'Lighting': return React.createElement('img', { src: '/folder_type_Lighting-light.png', className: 'tree-icon' });
            case 'Players': return React.createElement('img', { src: '/folder_type_Players-light.png', className: 'tree-icon' });
            case 'ServerScriptService': return React.createElement('img', { src: '/server_script_service.png', className: 'tree-icon' });
            case 'ServerStorage': return React.createElement('img', { src: '/server_storage.png', className: 'tree-icon' });
            case 'StarterGui': return React.createElement('img', { src: '/starter_gui.png', className: 'tree-icon' });
            case 'StarterPack': return React.createElement('img', { src: '/starter_pack.png', className: 'tree-icon' });
            case 'Teams': return React.createElement('img', { src: '/teams_service.png', className: 'tree-icon' });
            case 'SoundService': return React.createElement('img', { src: '/sound_service.png', className: 'tree-icon' });
            case 'Chat': return React.createElement('img', { src: '/chat_service.png', className: 'tree-icon' });
            case 'Model': return React.createElement('img', { src: '/Model.png', className: 'tree-icon' });
            case 'Baseplate':
            case 'Part': return React.createElement(Box, { size: 14, className: 'tree-icon' });
            case 'ReplicatedStorage': 
            case 'ReplicatedFirst':
                return React.createElement(Package, { size: 14, className: 'tree-icon' });
          }

          // Kind-based icons
          if (item.kind === 'Script') return React.createElement('img', { src: '/file_type_Script-light.png', className: 'tree-icon clickable', onClick: (e)=>{ e.stopPropagation(); window.studioApp?.openScript(item.index); } });
          if (item.kind === 'Part' || item.kind === 'SpawnLocation') return React.createElement(Box, { size: 14, className: 'tree-icon' });
          
          // Type-based icons (folders)
          if (item.isFolder) return React.createElement(context.isExpanded ? FolderOpen : Folder, { size: 14, className: 'tree-icon' });
          
          // Default icon for other items
          return React.createElement(File, { size: 14, className: 'tree-icon' });
        })();
        
        return React.createElement('div', { 
            className: 'tree-item-wrapper',
            onContextMenu: (e)=>{ e.preventDefault(); e.stopPropagation(); lastFocusedItemRef.current=item; setMenuState({ visible:true, x:e.clientX, y:e.clientY }); }
          },
          React.createElement('span', { className: 'tree-item-title' }, iconEl, title),
          isFolder && React.createElement('button', {
            className: 'add-item-button',
            onClick: (e) => {
              e.stopPropagation();
              lastFocusedItemRef.current = item;
              const rect = e.currentTarget.getBoundingClientRect();
              setMenuState({ visible: true, x: rect.right, y: rect.bottom });
            }
          }, React.createElement(Plus, { size: 14 }))
        );
      },
      viewState: viewState,
      canDragAndDrop: true,
      canDropOnFolder: true,
      canReorderItems: true,
    }, React.createElement(Tree, { treeId: 'explorer-tree', rootItem: 'root', treeLabel: 'Explorer Panel' })),
    menuState.visible && React.createElement('div',{className:'context-menu',style:{left:menuState.x+'px',top:menuState.y+'px',position:'fixed'}},React.createElement('button',{className:'menu-item',onClick:()=>createChild('Part')},'Create Part'),React.createElement('button',{className:'menu-item',onClick:()=>createChild('Script')},'Create Script'),React.createElement('button',{className:'menu-item',onClick:()=>createChild('Folder')},'Create Folder'))
  );
}

const container = document.getElementById('explorer-root');
if (container) {
  createRoot(container).render(React.createElement(ExplorerTree));
} else {
  console.error('Explorer root element (#explorer-root) not found.');
}