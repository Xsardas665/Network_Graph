import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Plus, Trash2, Network, Share2, Activity, Search, Server, Cpu, Database, Shield, Monitor, Box, Layers, Settings2, Globe, Wifi, Hexagon, Tag, Barcode, MapPin, Zap, Calendar, Edit3, Check, X, Tv, Gamepad2, Plug, Cloud, Lightbulb, ZoomIn, ZoomOut, Maximize } from 'lucide-react';

const NODE_TYPES = {
  Internet: { color: '#fbbf24', icon: Globe },
  Router: { color: '#6366f1', icon: Network },
  Switch: { color: '#8b5cf6', icon: Cpu },
  'Access Point': { color: '#ec4899', icon: Wifi },
  Server: { color: '#10b981', icon: Database },
  Container: { color: '#0ea5e9', icon: Box },
  Telewizor: { color: '#f43f5e', icon: Tv },
  Konsola: { color: '#14b8a6', icon: Gamepad2 },
  PC: { color: '#3b82f6', icon: Monitor },
  'Stacja Dokująca': { color: '#64748b', icon: Plug },
  'Maszyna Wirtualna': { color: '#c084fc', icon: Cloud },
  IOT: { color: '#f59e0b', icon: Lightbulb },
  Usługa: { color: '#f472b6', icon: Hexagon },
};

const LINK_TYPES = {
  'światłowód': { color: '#fbbf24', width: 3, dash: null, glow: true, shadow: '#fbbf24' },
  'RJ45 cat6': { color: '#3b82f6', width: 2, dash: null, shadow: '#3b82f666' },
  'RJ45 cat5': { color: '#60a5fa', width: 1.5, dash: null, shadow: '#60a5fa44' },
  'RJ45 cat7': { color: '#4f46e5', width: 2.5, dash: null, shadow: '#4f46e566' },
  'RJ45 cat8': { color: '#8b5cf6', width: 3, dash: null, shadow: '#8b5cf666' },
  'logical': { color: '#94a3b8', width: 1.5, dash: [4, 4], shadow: null },
  'wifi': { color: '#ec4899', width: 1.5, dash: [2, 4], shadow: '#ec489944' },
  'Sieć Zigbee': { color: '#10b981', width: 1.5, dash: [3, 3], shadow: '#10b98144' },
  'Control': { color: '#f43f5e', width: 2, dash: [6, 4], glow: true, shadow: '#f43f5e88' },
};

function App() {
  console.log('--- NetVis Logic+ Dashboard Version 2.0.1 (Stable) ---');
  const [data, setData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [newNode, setNewNode] = useState({ name: '', type: 'Router', parentId: '', interfaces: [] });
  const [newLink, setNewLink] = useState({ source: '', target: '', sourceInterface: '', targetInterface: '', label: '', type: 'RJ45 cat6' });
  const [searchTerm, setSearchTerm] = useState('');
  const [hoverNode, setHoverNode] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [showCmdbModal, setShowCmdbModal] = useState(false);
  const [editingCmdbId, setEditingCmdbId] = useState(null);
  const [tempCmdbData, setTempCmdbData] = useState(null);
  const [notification, setNotification] = useState(null);
  const [tempInterface, setTempInterface] = useState('');
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [activeLeftTab, setActiveLeftTab] = useState('ops');
  const fgRef = useRef();
  
  // Graph sizing
  const [graphSize, setGraphSize] = useState({ width: 800, height: 600 });
  const mainRef = useRef(null);

  // Measure main view
  useEffect(() => {
    const handleResize = () => {
      if (mainRef.current) {
        setGraphSize({
          width: mainRef.current.clientWidth,
          height: mainRef.current.clientHeight
        });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Toast Helper
  const showToast = (message) => {
    console.log('Showing notification:', message);
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  // Fetch data from API
  const fetchNetwork = async () => {
    try {
      const response = await fetch('/api/network');
      const networkData = await response.json();
      setData(networkData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching network:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNetwork();
  }, []);

  // Configure forces when engine starts/data changes
  useEffect(() => {
    const fg = fgRef.current;
    if (fg) {
      // Oblicz ilość połączeń dla każdego węzła
      const nodeLinkCount = {};
      if (data && data.links) {
        data.links.forEach(link => {
          const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
          const targetId = typeof link.target === 'object' ? link.target.id : link.target;
          nodeLinkCount[sourceId] = (nodeLinkCount[sourceId] || 0) + 1;
          nodeLinkCount[targetId] = (nodeLinkCount[targetId] || 0) + 1;
        });
      }

      if (fg.d3Force('charge')) {
        fg.d3Force('charge').strength(node => {
          const links = nodeLinkCount[node.id] || 0;
          // Bazowe odpychanie -1000, dodatkowo -800 za każde połączenie
          return -1000 - (links * 800);
        });
      }
      if (fg.d3Force('link')) fg.d3Force('link').distance(250);

      // Basic reheat without experimental methods
      if (fg.zoomToFit) fg.zoomToFit(400); 
    }
  }, [data]);

  // Auto-fill Link Source when a node is clicked
  useEffect(() => {
    if (selectedNodeId) {
      setNewLink(prev => ({ ...prev, source: selectedNodeId }));
    }
  }, [selectedNodeId]);

  useEffect(() => {
    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };
    
    // Prevent Safari pinch-to-zoom
    const handleGesture = (e) => {
      e.preventDefault();
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('gesturestart', handleGesture, { passive: false });

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('gesturestart', handleGesture);
    };
  }, []);

  // Auto-fit graph when data is loaded
  useEffect(() => {
    if (data.nodes.length > 0 && fgRef.current) {
      setTimeout(() => {
        fgRef.current.zoomToFit(800, 80);
      }, 500);
    }
  }, [data.nodes.length]);

  // Filtered nodes for inventory
  const filteredNodes = useMemo(() => {
    return data.nodes.filter(node => {
      const searchLower = searchTerm.toLowerCase();
      const nodeMatch = node.name.toLowerCase().includes(searchLower) ||
                       node.type.toLowerCase().includes(searchLower);
      
      const cmdbMatch = node.cmdb && (
        (node.cmdb.assetTag || '').toLowerCase().includes(searchLower) ||
        (node.cmdb.serial || '').toLowerCase().includes(searchLower) ||
        (node.cmdb.vendor || '').toLowerCase().includes(searchLower)
      );

      return nodeMatch || cmdbMatch;
    });
  }, [data.nodes, searchTerm]);

  // Parent Nodes (Nodes that can contain containers: Servers)
  const parentCandidates = useMemo(() => {
    return (data.nodes || []).filter(node => ['Server', 'Router', 'Switch'].includes(node.type));
  }, [data.nodes]);

  // Interfaces for current link selection
  const sourceNodeInterfaces = useMemo(() => {
    return data.nodes.find(n => n.id === newLink.source)?.interfaces || [];
  }, [data.nodes, newLink.source]);

  const targetNodeInterfaces = useMemo(() => {
    return data.nodes.find(n => n.id === newLink.target)?.interfaces || [];
  }, [data.nodes, newLink.target]);

  // Add Node
  const handleAddNode = async (e) => {
    e.preventDefault();
    if (!newNode.name) return;

    try {
      const response = await fetch('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newNode,
          cmdb: {
            assetTag: '',
            serial: '',
            vendor: '',
            model: '',
            status: 'production',
            location: '',
            ip: '',
            vlan: ''
          }
        }),
      });
      if (response.ok) {
        setNewNode({ name: '', type: 'Router', parentId: '', interfaces: [] });
        showToast('Device added successfully!');
        fetchNetwork();
      }
    } catch (error) {
      console.error('Error adding node:', error);
    }
  };

  // Add Interface to New Node state
  const addInterfaceToNewNode = () => {
    if (!tempInterface) return;
    setNewNode(prev => ({
      ...prev,
      interfaces: [...prev.interfaces, { id: `iface_${Date.now()}`, name: tempInterface }]
    }));
    setTempInterface('');
  };

  // Add Link
  const handleAddLink = async (e) => {
    e.preventDefault();
    if (!newLink.source || !newLink.target) return;

    try {
      const response = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLink),
      });
      if (response.ok) {
        setNewLink({ source: '', target: '', sourceInterface: '', targetInterface: '', label: '', type: 'RJ45 cat6' });
        showToast('Link established!');
        fetchNetwork();
      }
    } catch (error) {
      console.error('Error adding link:', error);
    }
  };

  // Update Node (Save IP, Interfaces etc.)
  const handleUpdateNode = async (updatedNode) => {
    const { __indexColor, index, x, y, vx, vy, fx, fy, __width, __height, __ports, ...sanitizedNode } = updatedNode;
    try {
      const response = await fetch(`/api/nodes/${sanitizedNode.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitizedNode),
      });
      if (response.ok) {
        showToast('Node details updated!');
        fetchNetwork();
      }
    } catch (error) {
      console.error('Error updating node:', error);
    }
  };

  // Delete Node
  const handleDeleteNode = async (id) => {
    try {
      await fetch(`/api/nodes/${id}`, { method: 'DELETE' });
      showToast('Device removed');
      if (selectedNodeId === id) setSelectedNodeId(null);
      fetchNetwork();
    } catch (error) {
      console.error('Error deleting node:', error);
    }
  };
  // Update Link
  const handleUpdateLink = async (linkId, updatedLink) => {
    const sanitizedLink = {
      ...updatedLink,
      source: typeof updatedLink.source === 'object' ? updatedLink.source.id : updatedLink.source,
      target: typeof updatedLink.target === 'object' ? updatedLink.target.id : updatedLink.target
    };
    delete sanitizedLink.__indexColor;
    delete sanitizedLink.__controlPoints;
    delete sanitizedLink.__photons;
    delete sanitizedLink.index;

    try {
      const response = await fetch(`/api/links/${linkId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitizedLink),
      });
      if (response.ok) {
        showToast('Connection updated!');
        fetchNetwork();
      }
    } catch (error) {
      console.error('Error updating link:', error);
    }
  };

  // Delete Link
  const handleDeleteLink = async (linkId) => {
    console.log('Attempting to delete link:', linkId);
    try {
      const response = await fetch(`/api/links/${linkId}`, { method: 'DELETE' });
      if (response.ok) {
        showToast('Connection removed');
        fetchNetwork();
      } else {
        console.error('Failed to delete link:', response.status);
        showToast('Error removing connection');
      }
    } catch (error) {
      console.error('Error deleting link:', error);
      showToast('Error removing connection');
    }
  };

  const startEditingCmdb = (node) => {
    setEditingCmdbId(node.id);
    setTempCmdbData(node.cmdb || {
      assetTag: '',
      serial: '',
      vendor: '',
      model: '',
      status: 'production',
      location: ''
    });
  };

  const handleInlineCmdbChange = (field, value) => {
    setTempCmdbData(prev => ({ ...prev, [field]: value }));
  };

  const saveInlineCmdb = async () => {
    const node = data.nodes.find(n => n.id === editingCmdbId);
    if (!node) return;

    const { __indexColor, index, x, y, vx, vy, fx, fy, __width, __height, __ports, ...sanitizedNode } = node;

    try {
      const response = await fetch(`/api/nodes/${editingCmdbId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sanitizedNode, cmdb: tempCmdbData })
      });

      if (response.ok) {
        setEditingCmdbId(null);
        setTempCmdbData(null);
        fetchNetwork();
        showToast('CMDB updated successfully');
      }
    } catch (error) {
      console.error('Error updating CMDB:', error);
      showToast('Error updating CMDB');
    }
  };

  // Graph Node Rendering Logic
  const paintNode = useCallback((node, ctx, globalScale) => {
    if (!node || typeof node.x === 'undefined' || typeof node.y === 'undefined') return;
    const { x, y, type, name, interfaces = [] } = node;
    const typeInfo = NODE_TYPES[type] || NODE_TYPES.Router;
    const isHovered = hoverNode === node.id || selectedNodeId === node.id;
    const isVirtual = type === 'Container';

    // LEVEL OF DETAIL (LOD) Logic
    const showDetails = globalScale > 1.2; // Lowered from 2.2
    const showCompactCard = globalScale > 0.4; // Lowered from 0.8

    if (!showCompactCard) {
      // LOW ZOOM: Simplified Minimalist Icon
      ctx.beginPath();
      if (isVirtual) {
        const radius = 6 / globalScale;
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          ctx.lineTo(x + radius * Math.cos(angle), y + radius * Math.sin(angle));
        }
        ctx.closePath();
      } else {
        const radius = 6 / globalScale;
        ctx.arc(x, y, radius, 0, 2*Math.PI);
      }
      ctx.fillStyle = typeInfo.color;
      ctx.fill();
      if (isHovered) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 / globalScale;
        ctx.stroke();
      }
      
      ctx.font = `${10 / globalScale}px 'Inter'`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(name, x, y + 15/globalScale);
      return;
    }

    // Node Dimensions (Dynamic Width based on text length)
    const nameFontSize = 11 / globalScale;
    ctx.font = `700 ${nameFontSize}px 'Inter'`;
    const textWidth = ctx.measureText(name).width;
    
    const minWidth = 110 / globalScale;
    const padding = 24 / globalScale; // 12px padding on each side
    const width = Math.max(minWidth, textWidth + padding);
    
    const headerHeight = 28 / globalScale;
    const totalHeight = 64 / globalScale;
    
    node.__width = width;
    node.__height = totalHeight;
    node.__ports = {};

    ctx.save();
    if (isHovered) {
      ctx.shadowColor = typeInfo.color;
      ctx.shadowBlur = 30 / globalScale;
    }

    // Main Card Body (Subtle Gradient)
    ctx.beginPath();
    ctx.roundRect(x - width/2, y - totalHeight/2, width, totalHeight, 8 / globalScale);
    const bgGradient = ctx.createLinearGradient(x, y - totalHeight/2, x, y + totalHeight/2);
    bgGradient.addColorStop(0, isVirtual ? '#1e293b' : '#0f172a');
    bgGradient.addColorStop(1, isVirtual ? '#0f172a' : '#020617');
    ctx.fillStyle = bgGradient;
    ctx.fill();
    ctx.strokeStyle = isHovered ? '#ffffff' : `${typeInfo.color}88`;
    ctx.lineWidth = (isHovered ? 2 : 1) / globalScale;
    ctx.stroke();
    ctx.restore();

    // Header Area
    ctx.beginPath();
    ctx.roundRect(x - width/2, y - totalHeight/2, width, headerHeight, [8/globalScale, 8/globalScale, 0, 0]);
    ctx.fillStyle = `${typeInfo.color}22`;
    ctx.fill();
    ctx.strokeStyle = `${typeInfo.color}44`;
    ctx.lineWidth = 0.5/globalScale;
    ctx.stroke();

    // ctx.font is already set earlier, but setting again is safe
    ctx.font = `700 ${nameFontSize}px 'Inter'`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(name, x, y - totalHeight/2 + 8/globalScale);

    // Always show type
    const typeFontSize = 8 / globalScale;
    ctx.font = `600 ${typeFontSize}px 'Inter'`;
    ctx.fillStyle = typeInfo.color;
    ctx.fillText(type.toUpperCase(), x, y - totalHeight/2 + headerHeight - 8/globalScale);

    const hasIp = !!node.cmdb?.ip;
    const hasVlan = !!node.cmdb?.vlan;

    if (hasIp || hasVlan) {
      const badgeY = y + 5 / globalScale;
      const badgeH = 15 / globalScale;
      
      if (hasIp && hasVlan) {
        // Unified Segmented Badge
        const ipW = 62 / globalScale;
        const vlanW = 42 / globalScale;
        const totalW = ipW + vlanW;
        const badgeX = x - totalW / 2;

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, totalW, badgeH, 4 / globalScale);
        ctx.clip(); 

        // IP Section (Left)
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(badgeX, badgeY, ipW, badgeH);

        // VLAN Section (Right)
        ctx.fillStyle = 'rgba(225,29,72,0.8)'; // Modern vibrant rose
        ctx.fillRect(badgeX + ipW, badgeY, vlanW, badgeH);
        
        ctx.restore();

        // Stroke the unified pill
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, totalW, badgeH, 4 / globalScale);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1 / globalScale;
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `600 ${7.5 / globalScale}px 'JetBrains Mono'`;
        
        // Text
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(node.cmdb.ip, badgeX + ipW/2, badgeY + badgeH/2);
        
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`VLAN ${node.cmdb.vlan}`, badgeX + ipW + vlanW/2, badgeY + badgeH/2);

      } else if (hasIp) {
        // Only IP
        const badgeW = 86 / globalScale;
        ctx.beginPath();
        ctx.roundRect(x - badgeW/2, badgeY, badgeW, badgeH, 4/globalScale);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1 / globalScale;
        ctx.stroke();
        
        ctx.font = `600 ${8 / globalScale}px 'JetBrains Mono'`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(node.cmdb.ip, x, badgeY + badgeH/2);

      } else if (hasVlan) {
        // Only VLAN
        const badgeW = 54 / globalScale;
        ctx.beginPath();
        ctx.roundRect(x - badgeW/2, badgeY, badgeW, badgeH, 4/globalScale);
        ctx.fillStyle = 'rgba(225,29,72,0.8)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1 / globalScale;
        ctx.stroke();
        
        ctx.font = `600 ${8 / globalScale}px 'JetBrains Mono'`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`VLAN ${node.cmdb.vlan}`, x, badgeY + badgeH/2);
      }
    }
  }, [hoverNode, selectedNodeId]);

  // Link labeling with custom line drawing
  const paintLink = useCallback((link, ctx, globalScale) => {
    const { source, target, sourceInterface, targetInterface, type } = link;
    if (typeof source !== 'object' || typeof target !== 'object') return;

    const typeInfo = LINK_TYPES[type] || LINK_TYPES['RJ45 cat6'];
    const isHovered = hoverNode === source.id || hoverNode === target.id;

    // Calculate Port Positions
    let sX = source.x;
    let sY = source.y;
    let tX = target.x;
    let tY = target.y;

    if (source.__ports && sourceInterface && source.__ports[sourceInterface]) {
      sX = source.__ports[sourceInterface].x;
      sY = source.__ports[sourceInterface].y;
    }
    if (target.__ports && targetInterface && target.__ports[targetInterface]) {
      tX = target.__ports[targetInterface].x;
      tY = target.__ports[targetInterface].y;
    }

    // Draw the Line
    ctx.save();
    if (typeInfo.glow || isHovered) {
      ctx.shadowBlur = 10 / globalScale;
      ctx.shadowColor = typeInfo.color;
    }
    
    ctx.beginPath();
    ctx.moveTo(sX, sY);
    ctx.lineTo(tX, tY);

    ctx.strokeStyle = isHovered ? '#ffffff' : typeInfo.color;
    ctx.lineWidth = (isHovered ? (typeInfo.width || 1.5) * 1.5 : (typeInfo.width || 1.5)) / globalScale;
    if (typeInfo.dash) ctx.setLineDash(typeInfo.dash.map(d => d / globalScale));
    else ctx.setLineDash([]);
    ctx.stroke();
    ctx.restore();
    ctx.setLineDash([]); // Reset

    // Draw Particles
    const isControl = type === 'Control';
    const isFiber = type === 'światłowód';

    const particleCount = isFiber ? 3 : (isControl ? 2 : 1);
    if (particleCount > 0) {
      const time = Date.now() * (isFiber ? 0.002 : (isControl ? 0.0015 : 0.001));
      for (let i = 0; i < particleCount; i++) {
        let progress = (time + i/particleCount) % 1;
        
        // Control type has a bouncing back-and-forth animation
        if (isControl) {
            let cycle = (time + i/particleCount) % 2;
            progress = cycle > 1 ? 2 - cycle : cycle;
        }

        const px = sX + (tX - sX) * progress;
        const py = sY + (tY - sY) * progress;
        
        ctx.beginPath();
        if (isControl) {
          ctx.rect(px - 2.5/globalScale, py - 2.5/globalScale, 5/globalScale, 5/globalScale);
          ctx.fillStyle = '#f43f5e';
        } else {
          ctx.arc(px, py, (isFiber ? 2 : 1) / globalScale, 0, 2*Math.PI);
          ctx.fillStyle = '#ffffff';
        }
        ctx.fill();

        if (typeInfo.glow || isControl) {
           ctx.shadowBlur = (isControl ? 8 : 5) / globalScale;
           ctx.shadowColor = isControl ? '#f43f5e' : '#ffffff';
        }
      }
      ctx.shadowBlur = 0; // Reset
    }
  }, [hoverNode]);

  return (
    <div className="app-container">
      {notification && <div className="toast">{notification}</div>}

      <div className="main-content-wrapper">
        {/* Main Graph View - Now Top Floor */}
        <main className="main-view" ref={mainRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          
          {/* Map Controls */}
          <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button className="secondary" style={{ padding: '8px', width: 'auto', borderRadius: '8px' }} onClick={() => fgRef.current?.zoom(fgRef.current.zoom() * 1.5, 400)} title="Zoom In">
              <ZoomIn size={18} />
            </button>
            <button className="secondary" style={{ padding: '8px', width: 'auto', borderRadius: '8px' }} onClick={() => fgRef.current?.zoom(fgRef.current.zoom() / 1.5, 400)} title="Zoom Out">
              <ZoomOut size={18} />
            </button>
            <button className="secondary" style={{ padding: '8px', width: 'auto', borderRadius: '8px' }} onClick={() => fgRef.current?.zoomToFit(400, 50)} title="Fit to View">
              <Maximize size={18} />
            </button>
          </div>

          <ForceGraph2D
            width={graphSize.width}
            height={graphSize.height}
            ref={fgRef}
            graphData={data}
            nodeLabel="name"
            nodeCanvasObject={paintNode}
            nodeCanvasObjectMode={() => 'replace'}
            nodePointerAreaPaint={(node, color, ctx, globalScale) => {
              const showCompactCard = globalScale > 0.4;
              ctx.fillStyle = color;
              if (showCompactCard) {
                const width = node.__width || (110 / globalScale);
                const totalHeight = node.__height || (64 / globalScale);
                ctx.fillRect(node.x - width / 2, node.y - totalHeight / 2, width, totalHeight);
              } else {
                ctx.beginPath();
                ctx.arc(node.x, node.y, 6 / globalScale, 0, 2 * Math.PI);
                ctx.fill();
              }
            }}
            onNodeHover={node => setHoverNode(node ? node.id : null)}
            onNodeClick={node => {
              setSelectedNodeId(node.id);
            }}
            onBackgroundClick={() => setSelectedNodeId(null)}
            linkColor={link => (hoverNode === link.source.id || hoverNode === link.target.id) ? '#ffffff' : (LINK_TYPES[link.type]?.color || 'rgba(255,255,255,0.3)')}
            linkCurvature={0}
            linkDirectionalParticles={link => link.type === 'światłowód' ? 6 : 2}
            linkDirectionalParticleWidth={link => link.type === 'światłowód' ? 2.5 : 1.5}
            linkDirectionalParticleSpeed={link => link.type === 'światłowód' ? 0.008 : 0.004}
            linkLineDash={link => LINK_TYPES[link.type]?.dash || null}
            linkCanvasObject={paintLink}
            linkCanvasObjectMode={() => 'replace'}
            linkLabel={d => `${d.type || ''} ${d.label || ''}`}
            cooldownTicks={100}
            minZoom={0.2}
            maxZoom={10}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
            warmupTicks={100}
            enableZoomInteraction={true}
            enablePanInteraction={true}
            onEngineStop={() => {
              if (fgRef.current) {
                fgRef.current.zoomToFit(400, 50); // fit to screen with 50px padding, 400ms transition
              }
            }}
          />
        </main>

      {/* Floating Header */}
      <div style={{ position: 'absolute', top: '20px', left: '20px', right: '20px', display: 'flex', justifyContent: 'space-between', zIndex: 10, pointerEvents: 'none' }}>
        <div style={{ background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(24px)', padding: '12px 24px', borderRadius: '16px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px', pointerEvents: 'auto' }}>
          <Network size={20} color="var(--primary)" />
          <h1 style={{ margin: 0, fontSize: '1rem', letterSpacing: '0.1em', color: 'white' }}>NETVIS LOGIC+</h1>
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Nodes: {data.nodes.length}
          </div>
        </div>
      </div>

      {/* Map-Centric Floating UI - Left Sidebar */}
      {isLeftPanelOpen && (
        <div className="left-panel" style={{ top: '80px' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '8px', padding: '16px', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
            <button 
              className={activeLeftTab === 'ops' ? '' : 'secondary'} 
              style={{ flex: 1, padding: '8px', fontSize: '0.7rem' }}
              onClick={() => setActiveLeftTab('ops')}
            >
              <Layers size={14} /> Operations
            </button>
            <button 
              className={activeLeftTab === 'inventory' ? '' : 'secondary'} 
              style={{ flex: 1, padding: '8px', fontSize: '0.7rem' }}
              onClick={() => setActiveLeftTab('inventory')}
            >
              <Activity size={14} /> Inventory
            </button>
          </div>

          <div className="left-panel-content">
            {activeLeftTab === 'ops' && (
              <div style={{ animation: 'slideInLeft 0.2s' }}>
                {/* Create Device Section */}
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: 'bold', letterSpacing: '0.05em' }}>ADD NEW DEVICE</div>
                  <div className="form-group" style={{ marginBottom: '8px' }}>
                    <input 
                      value={newNode.name} 
                      onChange={e => setNewNode({...newNode, name: e.target.value})}
                      placeholder="Device name..."
                    />
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                    <select value={newNode.type} onChange={e => setNewNode({...newNode, type: e.target.value})}>
                      {Object.keys(NODE_TYPES).map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                    <select value={newNode.parentId} onChange={e => setNewNode({...newNode, parentId: e.target.value})}>
                      <option value="">No parent...</option>
                      {parentCandidates.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <button onClick={handleAddNode}>Create Device</button>
                </div>

                {/* Create Link Section */}
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: 'bold', letterSpacing: '0.05em' }}>CONNECT DEVICES</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', marginBottom: '8px' }}>
                    <select value={newLink.source} onChange={e => setNewLink({...newLink, source: e.target.value})} style={{ border: newLink.source === selectedNodeId ? '1px solid var(--primary)' : undefined }}>
                      <option value="">Source Node...</option>
                      {data.nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                    </select>
                    <select value={newLink.target} onChange={e => setNewLink({...newLink, target: e.target.value})}>
                      <option value="">Target Node...</option>
                      {data.nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', marginTop: '12px' }}>
                    <select value={newLink.type} onChange={e => setNewLink({...newLink, type: e.target.value})}>
                      {Object.keys(LINK_TYPES).map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                    <button className="secondary" onClick={handleAddLink}>Connect</button>
                  </div>
                </div>
              </div>
            )}
            
            {activeLeftTab === 'inventory' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', animation: 'slideInLeft 0.2s' }}>
                <div style={{ position: 'relative', marginBottom: '16px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '8px', color: '#64748b' }} />
                  <input 
                    style={{ paddingLeft: '32px', height: '32px', fontSize: '0.75rem' }}
                    placeholder="Search inventory..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <table className="inventory-table">
                    <thead>
                      <tr>
                        <th>Device Name</th>
                        <th>Type</th>
                        <th style={{ width: '30px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredNodes.map(node => (
                        <tr 
                          key={node.id} 
                          className={selectedNodeId === node.id ? 'highlighted' : ''}
                          onClick={() => {
                            setSelectedNodeId(node.id);
                          }}
                        >
                          <td><div style={{ fontWeight: 600 }}>{node.name}</div></td>
                          <td style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{node.type}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button className="delete-btn" onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id); }}>
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button className="full-cmdb-btn" style={{ marginTop: '16px' }} onClick={() => setShowCmdbModal(true)}>
                  View Master CMDB
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      </div> {/* Zamknięcie main-content-wrapper */}


      {/* Conditional Right Panel: Selection Details */}
      {selectedNodeId && (
        <aside className="right-panel">
          <DeviceDetails 
            node={data.nodes.find(n => n.id === selectedNodeId)} 
            links={data.links}
            onClose={() => setSelectedNodeId(null)}
            onUpdate={handleUpdateNode}
            onDelete={handleDeleteNode}
            onDeleteLink={handleDeleteLink}
            onUpdateLink={handleUpdateLink}
          />
        </aside>
      )}

      {/* Modal: Full CMDB Table */}
      {showCmdbModal && (
        <div className="modal-overlay" onClick={() => setShowCmdbModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <Barcode size={24} color="var(--primary)" />
                <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Full Configuration Management Database</h2>
              </div>
              <button className="close-modal" onClick={() => setShowCmdbModal(false)}>Close Esc</button>
            </div>
            <div className="modal-body">
              <table className="large-table">
                <thead>
                  <tr>
                    <th>Device Name</th>
                    <th>Type</th>
                    <th>Asset Tag</th>
                    <th>Serial Number</th>
                    <th>Vendor</th>
                    <th>Model</th>
                    <th>Status</th>
                    <th>VLAN ID</th>
                    <th>Location</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.nodes.map(node => {
                    const isEditing = editingCmdbId === node.id;
                    const displayData = isEditing ? tempCmdbData : (node.cmdb || {});
                    
                    return (
                      <tr key={node.id} className={isEditing ? 'editing-row' : ''}>
                        <td style={{ fontWeight: 600 }}>{node.name}</td>
                        <td><span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{node.type}</span></td>
                        
                        <td>
                          {isEditing ? (
                            <input 
                              className="table-input"
                              value={displayData.assetTag || ''} 
                              onChange={e => handleInlineCmdbChange('assetTag', e.target.value)}
                              placeholder="Asset Tag"
                            />
                          ) : (
                            <code style={{ fontSize: '0.75rem' }}>{displayData.assetTag || '-'}</code>
                          )}
                        </td>

                        <td>
                          {isEditing ? (
                            <input 
                              className="table-input"
                              value={displayData.serial || ''} 
                              onChange={e => handleInlineCmdbChange('serial', e.target.value)}
                              placeholder="Serial"
                            />
                          ) : (
                            <code style={{ fontSize: '0.75rem' }}>{displayData.serial || '-'}</code>
                          )}
                        </td>

                        <td>
                          {isEditing ? (
                            <input 
                              className="table-input"
                              value={displayData.vendor || ''} 
                              onChange={e => handleInlineCmdbChange('vendor', e.target.value)}
                              placeholder="Vendor"
                            />
                          ) : (
                            displayData.vendor || '-'
                          )}
                        </td>

                        <td>
                          {isEditing ? (
                            <input 
                              className="table-input"
                              value={displayData.model || ''} 
                              onChange={e => handleInlineCmdbChange('model', e.target.value)}
                              placeholder="Model"
                            />
                          ) : (
                            displayData.model || '-'
                          )}
                        </td>

                        <td>
                          {isEditing ? (
                            <select 
                              className="table-input"
                              value={displayData.status || 'production'}
                              onChange={e => handleInlineCmdbChange('status', e.target.value)}
                            >
                              <option value="production">Production</option>
                              <option value="staging">Staging</option>
                              <option value="test">Test</option>
                              <option value="decommissioned">Decommissioned</option>
                            </select>
                          ) : (
                            displayData.status && (
                              <span className={`status-badge status-${displayData.status.toLowerCase()}`}>
                                {displayData.status}
                              </span>
                            )
                          )}
                        </td>

                        <td>
                          {isEditing ? (
                            <input 
                              className="table-input"
                              value={displayData.vlan || ''} 
                              onChange={e => handleInlineCmdbChange('vlan', e.target.value)}
                              placeholder="VLAN"
                            />
                          ) : (
                            <span style={{ color: displayData.vlan ? '#f43f5e' : 'inherit', fontWeight: displayData.vlan ? 600 : 'normal' }}>
                              {displayData.vlan ? `VLAN ${displayData.vlan}` : '-'}
                            </span>
                          )}
                        </td>

                        <td>
                          {isEditing ? (
                            <input 
                              className="table-input"
                              value={displayData.location || ''} 
                              onChange={e => handleInlineCmdbChange('location', e.target.value)}

                              placeholder="Location"
                            />
                          ) : (
                            displayData.location || '-'
                          )}
                        </td>

                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {isEditing ? (
                              <>
                                <button className="save-mini-btn" onClick={saveInlineCmdb} title="Save">
                                  <Check size={14} />
                                </button>
                                <button className="cancel-mini-btn" onClick={() => setEditingCmdbId(null)} title="Cancel">
                                  <X size={14} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button className="edit-mini-btn" onClick={() => startEditingCmdb(node)} title="Edit Device">
                                  <Edit3 size={16} />
                                </button>
                                <button 
                                  className="goto-btn"
                                  onClick={() => {
                                    setSelectedNodeId(node.id);
                                    setShowCmdbModal(false);
                                  }}
                                  title="Locate on Map"
                                >
                                  Find on Graph
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-component for Device Details
function DeviceDetails({ node, links, onClose, onUpdate, onDelete, onDeleteLink, onUpdateLink }) {
  const [activeTab, setActiveTab] = useState('network'); // 'network' or 'cmdb'
  
  // Ensure we always have an absolute copy with initialized arrays and objects
  const [editedNode, setEditedNode] = useState(() => ({
    ...node,
    interfaces: node?.interfaces || [],
    cmdb: node?.cmdb || {
      assetTag: '',
      serial: '',
      vendor: '',
      model: '',
      status: 'production',
      location: '',
      ip: '',
      vlan: ''
    }
  }));

  // Sync state if node changes (selection change)
  useEffect(() => {
    if (node) {
      setEditedNode({
        ...node,
        interfaces: node.interfaces || [],
        cmdb: node.cmdb || {
          assetTag: '',
          serial: '',
          vendor: '',
          model: '',
          status: 'production',
          location: '',
          ip: '',
          vlan: ''
        }
      });
      setActiveTab('network'); // Reset to network tab on node change
    }
  }, [node]);

  if (!node) return null;

  const handleIpChange = (ifaceId, newIp) => {
    const updatedInterfaces = editedNode.interfaces.map(iface => 
      iface.id === ifaceId ? { ...iface, ip: newIp } : iface
    );
    setEditedNode({ ...editedNode, interfaces: updatedInterfaces });
  };

  const handleNameChange = (ifaceId, newName) => {
    const updatedInterfaces = editedNode.interfaces.map(iface => 
      iface.id === ifaceId ? { ...iface, name: newName } : iface
    );
    setEditedNode({ ...editedNode, interfaces: updatedInterfaces });
  };

  const handleCmdbChange = (field, value) => {
    setEditedNode({
      ...editedNode,
      cmdb: { ...editedNode.cmdb, [field]: value }
    });
  };

  const addInterface = () => {
    const newIface = { id: `iface_${Date.now()}`, name: 'ethX', ip: '' };
    setEditedNode({ ...editedNode, interfaces: [...editedNode.interfaces, newIface] });
  };

  const removeInterface = (ifaceId) => {
    setEditedNode({ 
      ...editedNode, 
      interfaces: editedNode.interfaces.filter(i => i.id !== ifaceId) 
    });
  };

  return (
    <div className="details-view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <button onClick={onClose} className="secondary" style={{ width: 'auto', padding: '8px 12px' }}>
          ← Back
        </button>
        <button onClick={() => onDelete(node.id)} className="delete-btn" style={{ padding: '8px' }}>
          <Trash2 size={18} />
        </button>
      </div>

      <header style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{node.name}</h2>
        <style>{`
          .edit-mini-btn, .save-mini-btn, .cancel-mini-btn {
            width: 36px;
            height: 36px;
            padding: 0;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
          }
        `}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase' }}>{node.type}</span>
          {editedNode.cmdb.status && (
            <span className={`status-badge status-${editedNode.cmdb.status.toLowerCase()}`}>
              {editedNode.cmdb.status}
            </span>
          )}
        </div>
      </header>

      {/* Tabs Switcher */}
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'network' ? 'active' : ''}`}
          onClick={() => setActiveTab('network')}
        >
          <Network size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          Network
        </button>
        <button 
          className={`tab ${activeTab === 'cmdb' ? 'active' : ''}`}
          onClick={() => setActiveTab('cmdb')}
        >
          <Barcode size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          Asset Info
        </button>
      </div>

      {activeTab === 'network' ? (
        <section className="glass-card">
          <h3>Network Interfaces</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(editedNode.interfaces || []).map(iface => (
              <div key={iface.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 40px', gap: '8px', alignItems: 'center' }}>
                <input 
                  value={iface.name} 
                  onChange={e => handleNameChange(iface.id, e.target.value)}
                  placeholder="Name"
                  style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                />
                <input 
                  value={iface.ip || ''} 
                  onChange={e => handleIpChange(iface.id, e.target.value)}
                  placeholder="IP Address"
                  style={{ padding: '6px 10px', fontSize: '0.75rem', fontFamily: 'JetBrains Mono' }}
                />
                <button 
                  onClick={() => removeInterface(iface.id)}
                  className="delete-btn"
                  style={{ padding: '4px' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button onClick={addInterface} className="secondary" style={{ fontSize: '0.75rem', marginTop: '8px' }}>
              + Add Port
            </button>
          </div>

          <div style={{ marginTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
            <h3 style={{ fontSize: '0.9rem', marginBottom: '12px', color: '#94a3b8' }}>Active Connections</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {links.filter(l => {
                const sId = typeof l.source === 'object' ? l.source.id : l.source;
                const tId = typeof l.target === 'object' ? l.target.id : l.target;
                return sId === node.id || tId === node.id;
              }).map(link => {
                const sId = typeof link.source === 'object' ? link.source.id : link.source;
                const tId = typeof link.target === 'object' ? link.target.id : link.target;
                const isSource = sId === node.id;
                
                const otherNodeId = isSource ? tId : sId;
                // Try to find the name of the other node from the data
                const otherNode = links[0]?.source?.name ? (isSource ? link.target : link.source) : { name: otherNodeId };
                
                const myPort = isSource ? link.sourceInterface : link.targetInterface;
                const theirPort = isSource ? link.targetInterface : link.sourceInterface;

                return (
                  <div key={link.id} className="glass-card" style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.75rem' }}>
                        <span style={{ color: '#6366f1', fontWeight: 600 }}>{myPort || '?' }</span>
                        <span style={{ margin: '0 8px', color: '#475569' }}>↔</span>
                        <span>{otherNode.name || otherNodeId}</span>
                        <span style={{ marginLeft: '4px', color: '#64748b', fontSize: '0.65rem' }}>({theirPort || '?'})</span>
                        <div style={{ marginTop: '4px', color: LINK_TYPES[link.type]?.color || '#94a3b8', fontSize: '0.65rem' }}>
                          <select 
                            value={link.type || 'RJ45 cat6'}
                            onChange={(e) => onUpdateLink(link.id, { ...link, type: e.target.value })}
                            style={{ 
                              background: 'transparent', 
                              border: '1px solid rgba(255,255,255,0.2)', 
                              color: 'inherit',
                              fontSize: '0.65rem',
                              padding: '2px 4px',
                              borderRadius: '4px',
                              outline: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            {Object.keys(LINK_TYPES).map(t => <option key={t} value={t} style={{color: '#000'}}>{t}</option>)}
                          </select>
                        </div>
                      </div>
                      <button 
                        onClick={() => onDeleteLink(link.id)} 
                        className="delete-btn" 
                        style={{ padding: '6px', width: '28px', height: '28px' }}
                        title="Remove Connection"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {links.filter(l => {
                const sId = typeof l.source === 'object' ? l.source.id : l.source;
                const tId = typeof l.target === 'object' ? l.target.id : l.target;
                return sId === node.id || tId === node.id;
              }).length === 0 && (
                <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center', padding: '10px' }}>
                  No active connections
                </div>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="glass-card">
          <h3>Asset Metadata (CMDB)</h3>
          <div className="cmdb-grid">
            <div className="cmdb-field">
              <label><Tag size={12} /> Asset Tag</label>
              <input 
                value={editedNode.cmdb.assetTag} 
                onChange={e => handleCmdbChange('assetTag', e.target.value)}
                placeholder="e.g. NET-V-001"
              />
            </div>
            <div className="cmdb-field">
              <label><Barcode size={12} /> Serial Number</label>
              <input 
                value={editedNode.cmdb.serial} 
                onChange={e => handleCmdbChange('serial', e.target.value)}
                placeholder="SN-XXXX-XXXX"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="cmdb-field">
                <label><Layers size={12} /> Vendor</label>
                <input 
                  value={editedNode.cmdb.vendor} 
                  onChange={e => handleCmdbChange('vendor', e.target.value)}
                  placeholder="e.g. Cisco"
                />
              </div>
              <div className="cmdb-field">
                <label><Monitor size={12} /> Model</label>
                <input 
                  value={editedNode.cmdb.model} 
                  onChange={e => handleCmdbChange('model', e.target.value)}
                  placeholder="e.g. C9200-24T"
                />
              </div>
            </div>
            <div className="cmdb-field">
              <label><Zap size={12} /> Status</label>
              <select 
                value={editedNode.cmdb.status} 
                onChange={e => handleCmdbChange('status', e.target.value)}
                style={{ background: 'transparent', padding: '0', border: 'none', width: '100%', fontSize: '0.85rem' }}
              >
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="test">Test / Lab</option>
                <option value="decommissioned">Decommissioned</option>
              </select>
            </div>
            <div className="cmdb-field">
              <label><MapPin size={12} /> Location</label>
              <input 
                value={editedNode.cmdb.location} 
                onChange={e => handleCmdbChange('location', e.target.value)}
                placeholder="e.g. DataCenter 1, Rack B"
              />
            </div>
            <div className="cmdb-field">
              <label><Globe size={12} /> Management Address (IP)</label>
              <input 
                value={editedNode.cmdb.ip || ''} 
                onChange={e => handleCmdbChange('ip', e.target.value)}
                placeholder="e.g. 192.168.1.1"
              />
            </div>
            <div className="cmdb-field">
              <label><Layers size={12} /> VLAN Segment ID</label>
              <input 
                value={editedNode.cmdb.vlan || ''} 
                onChange={e => handleCmdbChange('vlan', e.target.value)}
                placeholder="e.g. 10"
              />
            </div>
          </div>
        </section>
      )}

      <button 
        onClick={() => onUpdate(editedNode)}
        style={{ marginTop: '24px', background: 'var(--success)' }}
      >
        Save Configuration
      </button>
    </div>
  );
}

export default App;
