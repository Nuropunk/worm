"use client"

import React, { useRef, useState, useEffect, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import axios from 'axios';
import { ITransaction, WormHistory } from './types';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ImprovedTooltip } from './ToolTip';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';

const shortenHash = (hash: string): string => {
  if (!hash) return '';
  return `${hash.slice(0, 4)}...${hash.slice(-4)}`;
}


export function InfiniteGridMapComponent() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gridRef = useRef<Set<string>>(new Set())
  const wormImageRef = useRef<HTMLImageElement | null>(null);

  const [camera, setCamera] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 })

  const [wormPosition, setWormPosition] = useState({ x: 0, y: 0 })
  const [wormHistory, setWormHistory] = useState<WormHistory[]>([])

  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<WormHistory | null>(null)

  const [hoveredHistoryItem, setHoveredHistoryItem] = useState<WormHistory | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 }) // For tooltip position

  const [cellSize, setCellSize] = useState(40)
  const [dotSize, setDotSize] = useState(6)
  const [wormSize, setWormSize] = useState(50)

  // Add this new function near other state declarations
  const animationRef = useRef<number>()
  const [, setIsLocating] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [recentTransactions, setRecentTransactions] = useState<ITransaction[]>([])
  const [activeTab, setActiveTab] = useState<'history' | 'recent'>('recent');

  const historyScreenPositionsRef = useRef<{ x: number, y: number, data: WormHistory }[]>([])

  useEffect(() => {
    // start super zoomed out
    const ZOOM_FACTOR = 0.1
    setCellSize(prev => prev * ZOOM_FACTOR)
    setDotSize(prev => prev * ZOOM_FACTOR)
    setWormSize(prev => prev * ZOOM_FACTOR)
  }, [])

  // Disable pull to refresh
  useEffect(() => {
    const preventDefault = (e: TouchEvent) => {
      e.preventDefault();
    };
    document.addEventListener('touchmove', preventDefault, { passive: false });
    return () => {
      document.removeEventListener('touchmove', preventDefault);
    };
  }, []);



  useEffect(() => {
    const wormImage = new Image();
    wormImage.src = '/werm.png';
    wormImage.onload = () => {
      wormImageRef.current = wormImage;
    };
  }, []);

  useEffect(() => {
    const fetchData = () => {
      setIsLoading(true);
      axios.get('/api/rpc').then((res) => {
        const data = res.data;
        setWormHistory(data);
        setIsLoading(false);
        const latestWormPosition = data[data.length - 1];
        if (latestWormPosition) {
          setWormPosition({
            x: latestWormPosition.x,
            y: latestWormPosition.y
          });
          locateWorm();
        }
      });

      // Fetch recent transactions
      axios.get('/api/recent').then((res) => {
        setRecentTransactions(res.data);
      });
    };

    // Initial fetch
    fetchData();

    // Set up interval to fetch every minute
    const interval = setInterval(fetchData, 60000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, []);

  const drawGrid = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)'
    ctx.lineWidth = 0.5
    ctx.font = '10px Arial'
    ctx.fillStyle = '#000'

    const startX = Math.floor(camera.x / cellSize) * cellSize - camera.x
    const startY = Math.floor(camera.y / cellSize) * cellSize - camera.y

    const dynamicLabelInterval = Math.max(1, Math.floor(40 / cellSize)); // Adjust based on zoom level

    for (let x = startX; x < width; x += cellSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
      const gridX = Math.floor((x + camera.x) / cellSize)
      if (gridX % dynamicLabelInterval === 0) { // Only display every 5th label
        ctx.fillText(gridX.toString(), x + 2, 10)
      }
    }

    for (let y = startY; y < height; y += cellSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
      const gridY = Math.floor((y + camera.y) / cellSize)
      if (gridY % dynamicLabelInterval === 0) {
        ctx.fillText(gridY.toString(), 2, y - 2)
      }
    }
  }, [camera, cellSize])

  const drawDots = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.fillStyle = 'rgba(0, 100, 255, 0.7)'
    gridRef.current.forEach((key) => {
      const [x, y] = key.split(',').map(Number)
      const screenX = x * cellSize - camera.x
      const screenY = y * cellSize - camera.y
      if (screenX >= -dotSize && screenX <= width + dotSize && screenY >= -dotSize && screenY <= height + dotSize) {
        ctx.beginPath()
        ctx.arc(screenX, screenY, dotSize / 2, 0, Math.PI * 2)
        ctx.fill()
      }
    })
  }, [camera, cellSize, dotSize])

  const drawWormHistory = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = 'rgba(128, 128, 128, 0.7)' // Light grey
    // Skip drawing history point if it's at current worm position
    historyScreenPositionsRef.current = [] // Reset the array

    wormHistory.forEach((historyItem) => {
      // Make history point transparent if it's at current worm position
      if (historyItem.x === wormPosition.x && historyItem.y === wormPosition.y) {
        ctx.fillStyle = 'rgba(128, 128, 128, 0)' // Very transparent grey
      } else {
        ctx.fillStyle = 'rgba(128, 128, 128, 0.7)' // Regular semi-transparent grey
      }

      // If origin, make it red
      if (historyItem.x === 0 && historyItem.y === 0) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.7)' // Red
      }

      const screenX = historyItem.x * cellSize - camera.x
      const screenY = historyItem.y * cellSize - camera.y

      ctx.beginPath()
      ctx.arc(screenX, screenY, wormSize / 8, 0, Math.PI * 2)
      ctx.fill()

      // Store screen position and data for hit-testing
      historyScreenPositionsRef.current.push({
        x: screenX,
        y: screenY,
        data: historyItem
      })
    })
  }, [camera, wormHistory, cellSize, dotSize, wormSize])

  const drawWorm = useCallback((ctx: CanvasRenderingContext2D) => {
    const screenX = wormPosition.x * cellSize - camera.x;
    const screenY = wormPosition.y * cellSize - camera.y;

    // Draw worm image if it's loaded
    if (wormImageRef.current) {
      ctx.drawImage(wormImageRef.current, screenX - wormSize / 2, screenY - wormSize / 2, wormSize, wormSize);
    }

    // Add label below the worm
    ctx.fillStyle = 'black';
    ctx.font = '15px Arial';
    ctx.fillText('Worm', screenX - 20, screenY + wormSize * 0.5);
  }, [camera, wormPosition, cellSize, wormSize]);




  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    drawGrid(ctx, canvas.width, canvas.height)
    drawDots(ctx, canvas.width, canvas.height)
    drawWormHistory(ctx)
    drawWorm(ctx)
  }, [drawGrid, drawDots, drawWormHistory, drawWorm])

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const pixelRatio = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;

      // Set canvas width and height according to pixel ratio for Retina displays
      canvas.width = width * pixelRatio;
      canvas.height = height * pixelRatio;

      // Style width and height remain the same
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      // Scale the context to match the pixel ratio
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      render();
    }

    window.addEventListener('resize', handleResize)
    handleResize()

    return () => window.removeEventListener('resize', handleResize)
  }, [render])

  useEffect(() => {
    render()
  }, [cellSize, dotSize, wormSize, render])

  const handleZoom = (event: WheelEvent) => {
    event.preventDefault();
    const zoomFactor = 1.05;
    const canvas = canvasRef.current;
    if (canvas) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        setIsLocating(false);
      }
      if (event.deltaY < 0) {
        // Zoom in
        setCellSize(prev => prev * zoomFactor);
        setDotSize(prev => prev * zoomFactor);
        setWormSize(prev => prev * zoomFactor);
      } else {
        // Zoom out
        setCellSize(prev => prev / zoomFactor);
        setDotSize(prev => prev / zoomFactor);
        setWormSize(prev => prev / zoomFactor);
      }
      render(); // Re-render the grid
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('wheel', handleZoom);
    }
    return () => {
      if (canvas) {
        canvas.removeEventListener('wheel', handleZoom);
      }
    };
  }, [render]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0) { // Left click
      setIsDragging(true)
      setLastMousePos({ x: e.clientX, y: e.clientY })
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        setIsLocating(false)
      }
    } else if (e.button === 2) { // Right click
      render()
    }

    if (!isDragging && hoveredHistoryItem) {
      setSelectedHistoryItem(hoveredHistoryItem)
      setIsDrawerOpen(true)
      setMousePos({ x: e.clientX, y: e.clientY })
    } else {
      setHoveredHistoryItem(null)
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      const dx = e.clientX - lastMousePos.x
      const dy = e.clientY - lastMousePos.y
      setCamera(prev => ({ x: prev.x - dx, y: prev.y - dy }))
      setLastMousePos({ x: e.clientX, y: e.clientY })
    } else {
      // Hit-test historical positions
      const rect = canvasRef.current?.getBoundingClientRect()
      if (rect) {
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        const hoverItem = historyScreenPositionsRef.current.find(pos => {
          const dx = x - pos.x
          const dy = y - pos.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          return distance <= wormSize / 2 // Increased hit area
        })

        if (hoverItem) {
          setHoveredHistoryItem(hoverItem.data)
        } else {
          setHoveredHistoryItem(null)
        }
      }
      setMousePos({ x: e.clientX, y: e.clientY })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
  }

  useEffect(() => {
    render();
  }, [cellSize, dotSize, wormSize, render]);

  // Update locateWorm function
  const locateWorm = (zoom?: boolean) => {
    const targetX = wormPosition.x * cellSize - window.innerWidth / 2
    const targetY = wormPosition.y * cellSize - window.innerHeight / 2

    // Cancel any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }

    setIsLocating(true)

    // Set the zoom level to the default value
    if (zoom) {
      setCellSize(40)
      setDotSize(6)
      setWormSize(50)
    }

    const animate = () => {
      setCamera(prev => {
        const dx = targetX - prev.x
        const dy = targetY - prev.y

        // If we're close enough, stop animating
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
          setIsLocating(false)
          return { x: targetX, y: targetY }
        }
        return {
          x: prev.x + dx * 0.1,
          y: prev.y + dy * 0.1
        }
      })
      // Continue animation if we're not at target
      animationRef.current = requestAnimationFrame(animate)
    }

    animate()
  }

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const touch = e.touches[0];
    setIsDragging(true);
    setLastMousePos({ x: touch.clientX, y: touch.clientY });
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      setIsLocating(false);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (isDragging) {
      const touch = e.touches[0];
      const dx = touch.clientX - lastMousePos.x;
      const dy = touch.clientY - lastMousePos.y;
      setCamera(prev => ({ x: prev.x - dx, y: prev.y - dy }));
      setLastMousePos({ x: touch.clientX, y: touch.clientY });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  return (
    <div className="relative w-screen h-screen">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="cursor-move"
      />
      {isLoading && <div className="absolute inset-0 flex items-center justify-center bg-white/50">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>}

      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <Button
          onClick={() => {
            const canvas = canvasRef.current;
            if (canvas) {
              if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                setIsLocating(false);
              }
              setCellSize(prev => prev * 1.2)
              setDotSize(prev => prev * 1.2)
              setWormSize(prev => prev * 1.2)
              render()
            }
          }}
          className="w-10 h-10 rounded-full text-xl"
        >
          +
        </Button>
        <Button
          onClick={() => {
            const canvas = canvasRef.current;
            if (canvas) {
              if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                setIsLocating(false);
              }
              setCellSize(prev => prev * 0.8)
              setDotSize(prev => prev * 0.8)
              setWormSize(prev => prev * 0.8)
              render()
            }
          }}
          className="w-10 h-10 rounded-full text-xl"
        >
          -
        </Button>
      </div>

      <Button onClick={() => locateWorm(true)} className="fixed bottom-4 md:left-1/2 md:-translate-x-1/2 left-4 font-bold flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        Locate the Worm
      </Button>

      <div className="fixed bottom-4 right-4 flex gap-2">
        <a
          href="https://github.com/deep-worm"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white hover:bg-gray-100 p-2 rounded-full shadow"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
          </svg>
        </a>
        <a
          href="https://x.com/thedeepworm_"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white hover:bg-gray-100 p-2 rounded-full shadow"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
          </svg>
        </a>
        <a
          href="https://t.me/thedeepworm"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white hover:bg-gray-100 p-2 rounded-full shadow"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.2 5L2.5 12.8c-1.1.4-1.1 1.1-.2 1.4l4.7 1.5 1.8 5.6c.2.7.7.7 1 .4l2.8-2.3 5.5 4.2c1 .5 1.7.2 2-1l3.7-17.4c.4-1.5-.4-2.1-1.6-1.7z" />
          </svg>
        </a>
        {/* <a
          href="/whitepaper.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white hover:bg-gray-100 p-2 rounded-full shadow"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </a> */}
        <a
          href="https://dexscreener.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white hover:bg-gray-100 p-2 rounded-full shadow"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="20" x2="12" y2="10" />
            <line x1="18" y1="20" x2="18" y2="4" />
            <line x1="6" y1="20" x2="6" y2="16" />
          </svg>
        </a>
      </div>


      <div className="absolute top-4 right-4 flex flex-col items-end">
        <div className="bg-white rounded shadow max-h-[300px] w-[300px] overflow-y-auto">
          <div className="flex gap-2 mb-3 sticky top-0 bg-white p-2 z-10">
            <button
              className={`text-sm font-medium px-3 py-1 rounded-t border-b-2 ${activeTab === 'history' ? 'text-gray-700 border-gray-700' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
              onClick={() => setActiveTab('history')}
            >
              History
            </button>
            <button
              className={`text-sm font-medium px-3 py-1 rounded-t border-b-2 ${activeTab === 'recent' ? 'text-gray-700 border-gray-700' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
              onClick={() => setActiveTab('recent')}
            >
              Recent Inputs
            </button>
          </div>
          {activeTab === 'history' ? (
            <ul className="space-y-2 px-4">
              {wormHistory.sort((a, b) => b.index - a.index).map((pos, index) => (
                <li
                  key={index}
                  className="text-xs text-gray-600 flex justify-between hover:bg-gray-50 py-0.5 cursor-pointer rounded"
                  onClick={() => {
                    setIsDrawerOpen(true);
                    setSelectedHistoryItem(pos)
                  }}
                >
                  <span className="font-mono">({pos.x}, {pos.y})</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">{pos.direction}</span>
                    <span className="text-gray-400">
                      {wormHistory.length - index - 1 === 0
                        ? 'now'
                        : `${Math.floor((Date.now() - pos.timestamp) / 1000) < 60
                          ? `${Math.floor((Date.now() - pos.timestamp) / 1000)}s ago`
                          : Math.floor((Date.now() - pos.timestamp) / 60000) < 60
                            ? `${Math.floor((Date.now() - pos.timestamp) / 60000)}m ago`
                            : `${Math.floor((Date.now() - pos.timestamp) / 3600000)}h ago`}`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-2 px-4">
              {recentTransactions.length === 0 && (
                <div className="flex items-center justify-center pb-2 -mt-2 text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  <span className="text-sm">Waiting for inputs (txs)...</span>
                </div>
              )}
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-gray-500">
                    <th className="text-left pb-2">Time</th>
                    <th className="text-left pb-2">From</th>
                    <th className="text-right pb-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((tx, index) => {
                    const timeAgo = tx.blockTime
                      ? Math.floor((Date.now() - tx.blockTime * 1000) / 1000) < 60
                        ? `${Math.floor((Date.now() - tx.blockTime * 1000) / 1000)}s ago`
                        : Math.floor((Date.now() - tx.blockTime * 1000) / 60000) < 60
                          ? `${Math.floor((Date.now() - tx.blockTime * 1000) / 60000)}m ago`
                          : `${Math.floor((Date.now() - tx.blockTime * 1000) / 3600000)}h ago`
                      : 'Pending';

                    const amount = (Number(tx.amount) / 1e9).toFixed(2);

                    return (
                      <tr
                        key={index}
                        className="text-xs text-gray-600 hover:bg-gray-50 cursor-pointer"
                        onClick={() => window.open(`https://solscan.io/tx/${tx.signature}`, '_blank')}
                      >
                        <td className="py-1">{timeAgo}</td>
                        <td className="py-1">
                          <span className="bg-gray-100 px-2 py-0.5 rounded-full">
                            {shortenHash(tx.from)}
                          </span>
                        </td>
                        <td className="text-right py-1">{amount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ul>
          )}
        </div>
      </div>
      {hoveredHistoryItem && (
        <ImprovedTooltip
          mousePos={mousePos}
          hoveredHistoryItem={hoveredHistoryItem}
          wormPosition={wormPosition}
          wormHistory={wormHistory}
        />
      )}

      <Dialog open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <div className="relative">
            <img
              src="/werm.png"
              alt="Worm"
              className={`w-16 h-16 mx-auto ${selectedHistoryItem?.x !== wormPosition.x || selectedHistoryItem?.y !== wormPosition.y ? 'grayscale opacity-30' : ''}`}
            />
            {(selectedHistoryItem?.x !== wormPosition.x || selectedHistoryItem?.y !== wormPosition.y) && (
              <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-gray-500">
                ?
              </div>
            )}
          </div>
          <DialogHeader>
            <DialogTitle>
              {selectedHistoryItem?.x === wormPosition.x && selectedHistoryItem?.y === wormPosition.y
                ? 'Current Worm Position'
                : selectedHistoryItem?.index === 0
                  ? 'GENESIS Position'
                  : `${wormHistory.length - (selectedHistoryItem?.index || 0)} steps ago`}
            </DialogTitle>
          </DialogHeader>
          {selectedHistoryItem && (
            <div className="mt-2 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Position:</span>
                <div className="flex items-center gap-2">
                  <span>({selectedHistoryItem.x}, {selectedHistoryItem.y})</span>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Inputs ({selectedHistoryItem.affectedTransactions.length})</h4>
                <ScrollArea className="h-[200px]">
                  <div className="flex gap-1 flex-wrap">
                    {selectedHistoryItem.affectedTransactions.map((tx, i) => (
                      <Badge key={i} variant="secondary" className="cursor-pointer hover:bg-secondary/80 text-gray-600">
                        <a
                          href={`https://solscan.io/tx/${tx}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1"
                        >
                          {shortenHash(tx)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </Badge>
                    ))}
                  </div>
                </ScrollArea>
              </div>
              <div>
                <span className="font-semibold">Neural Output:</span>{' '}
                {selectedHistoryItem.direction.charAt(0).toUpperCase() + selectedHistoryItem.direction.slice(1)}
              </div>
              <div className="mt-4">
                <a
                  href="/whitepaper.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1"
                >
                  Read the whitepaper <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

<style jsx>{`
  .drawer {
    transition: transform 0.3s ease-in-out;
    transform: translateY(100%);
  }
  .drawer-open {
    transform: translateY(0);
  }
`}</style>