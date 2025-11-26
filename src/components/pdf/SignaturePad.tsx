'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Trash2, Check, Palette, Eraser, Undo, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SignaturePadProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (signatureData: string) => void;
    fieldLabel?: string;
}

// Background color options
const BACKGROUND_COLORS = [
    { id: 'transparent', label: 'Transparent', value: 'transparent', preview: 'bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%3E%3Crect%20width%3D%228%22%20height%3D%228%22%20fill%3D%22%23ccc%22%2F%3E%3Crect%20x%3D%228%22%20y%3D%228%22%20width%3D%228%22%20height%3D%228%22%20fill%3D%22%23ccc%22%2F%3E%3C%2Fsvg%3E")]' },
    { id: 'white', label: 'White', value: '#FFFFFF', preview: 'bg-white' },
    { id: 'cream', label: 'Cream', value: '#FFFEF0', preview: 'bg-[#FFFEF0]' },
    { id: 'lightGray', label: 'Light Gray', value: '#F5F5F5', preview: 'bg-[#F5F5F5]' },
    { id: 'lightBlue', label: 'Light Blue', value: '#F0F8FF', preview: 'bg-[#F0F8FF]' },
    { id: 'lightYellow', label: 'Light Yellow', value: '#FFFACD', preview: 'bg-[#FFFACD]' },
    { id: 'lightPink', label: 'Light Pink', value: '#FFF0F5', preview: 'bg-[#FFF0F5]' },
    { id: 'lightGreen', label: 'Light Green', value: '#F0FFF0', preview: 'bg-[#F0FFF0]' },
];

// Pen color options
const PEN_COLORS = [
    { id: 'black', label: 'Black', value: '#000000' },
    { id: 'darkBlue', label: 'Dark Blue', value: '#00008B' },
    { id: 'blue', label: 'Blue', value: '#0066CC' },
    { id: 'red', label: 'Red', value: '#CC0000' },
    { id: 'green', label: 'Green', value: '#006600' },
    { id: 'purple', label: 'Purple', value: '#660099' },
];

// Pen size options
const PEN_SIZES = [
    { id: 'thin', label: 'Thin', value: 1.5 },
    { id: 'medium', label: 'Medium', value: 2.5 },
    { id: 'thick', label: 'Thick', value: 4 },
];

export function SignaturePad({ isOpen, onClose, onSave, fieldLabel }: SignaturePadProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [backgroundColor, setBackgroundColor] = useState<string>('transparent');
    const [penColor, setPenColor] = useState('#000000');
    const [penSize, setPenSize] = useState(2.5);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [history, setHistory] = useState<ImageData[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const lastPoint = useRef<{ x: number; y: number } | null>(null);

    // Initialize canvas
    useEffect(() => {
        if (isOpen && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // Set canvas size
                canvas.width = 600;
                canvas.height = 200;
                
                // Clear and set background
                clearCanvas();
                
                // Save initial state
                saveToHistory();
            }
        }
    }, [isOpen]);

    // Clear canvas with current background
    const clearCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (backgroundColor === 'transparent') {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }, [backgroundColor]);

    // Save current canvas state to history
    const saveToHistory = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Remove any future history if we're not at the end
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(imageData);
        
        // Limit history to 20 states
        if (newHistory.length > 20) {
            newHistory.shift();
        }
        
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    }, [history, historyIndex]);

    // Undo last action
    const undo = useCallback(() => {
        if (historyIndex <= 0) return;
        
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const newIndex = historyIndex - 1;
        ctx.putImageData(history[newIndex], 0, 0);
        setHistoryIndex(newIndex);
    }, [history, historyIndex]);

    // Handle background color change
    const handleBackgroundChange = useCallback((color: string) => {
        setBackgroundColor(color);
        
        // Redraw canvas with new background
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Save current drawing
        const currentDrawing = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Clear with new background
        if (color === 'transparent') {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        // Restore drawing on top (this is a simplified approach)
        // For transparent, we need to preserve non-transparent pixels
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
            tempCtx.putImageData(currentDrawing, 0, 0);
            ctx.drawImage(tempCanvas, 0, 0);
        }
        
        saveToHistory();
    }, [saveToHistory]);

    // Get coordinates from event
    const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        if ('touches' in e) {
            const touch = e.touches[0];
            return {
                x: (touch.clientX - rect.left) * scaleX,
                y: (touch.clientY - rect.top) * scaleY,
            };
        } else {
            return {
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY,
            };
        }
    };

    // Start drawing
    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const coords = getCoordinates(e);
        if (!coords) return;

        setIsDrawing(true);
        lastPoint.current = coords;
    };

    // Draw on canvas
    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        if (!isDrawing || !lastPoint.current) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const coords = getCoordinates(e);
        if (!coords) return;

        // Draw smooth line
        ctx.beginPath();
        ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.strokeStyle = penColor;
        ctx.lineWidth = penSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        lastPoint.current = coords;
    };

    // Stop drawing
    const stopDrawing = () => {
        if (isDrawing) {
            setIsDrawing(false);
            lastPoint.current = null;
            saveToHistory();
        }
    };

    // Handle clear
    const handleClear = () => {
        clearCanvas();
        saveToHistory();
    };

    // Handle save
    const handleSave = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Convert to base64
        const format = backgroundColor === 'transparent' ? 'image/png' : 'image/png';
        const signatureData = canvas.toDataURL(format);
        
        onSave(signatureData);
        onClose();
    };

    // Check if canvas is empty
    const isCanvasEmpty = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return true;

        const ctx = canvas.getContext('2d');
        if (!ctx) return true;

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // For transparent background, check for any non-transparent pixels
        if (backgroundColor === 'transparent') {
            for (let i = 3; i < data.length; i += 4) {
                if (data[i] > 0) return false;
            }
            return true;
        }

        // For solid backgrounds, this is more complex - just allow save
        return false;
    }, [backgroundColor]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />
            
            {/* Modal */}
            <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-[700px] mx-4 overflow-hidden animate-scale-in border border-border">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <div>
                        <h2 className="text-xl font-bold text-foreground">
                            ✍️ Draw Your Signature
                        </h2>
                        {fieldLabel && (
                            <p className="text-sm text-muted-foreground mt-0.5">
                                For: {fieldLabel}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-muted rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="px-6 py-3 bg-muted/50 border-b border-border">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        {/* Left: Pen options */}
                        <div className="flex items-center gap-4">
                            {/* Pen Color */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground">Pen:</span>
                                <div className="flex items-center gap-1">
                                    {PEN_COLORS.map((color) => (
                                        <button
                                            key={color.id}
                                            onClick={() => setPenColor(color.value)}
                                            className={cn(
                                                "w-6 h-6 rounded-full border-2 transition-all",
                                                penColor === color.value 
                                                    ? "border-primary scale-110 shadow-md" 
                                                    : "border-border hover:border-muted-foreground"
                                            )}
                                            style={{ backgroundColor: color.value }}
                                            title={color.label}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Pen Size */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground">Size:</span>
                                <div className="flex items-center gap-1">
                                    {PEN_SIZES.map((size) => (
                                        <button
                                            key={size.id}
                                            onClick={() => setPenSize(size.value)}
                                            className={cn(
                                                "px-2 py-1 rounded text-xs font-medium transition-all",
                                                penSize === size.value
                                                    ? "bg-primary text-white"
                                                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                                            )}
                                        >
                                            {size.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right: Background & Actions */}
                        <div className="flex items-center gap-2">
                            {/* Background Color Picker */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowColorPicker(!showColorPicker)}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                                        showColorPicker
                                            ? "bg-primary text-white"
                                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                                    )}
                                >
                                    <Palette className="w-4 h-4" />
                                    Background
                                </button>
                                
                                {/* Color Picker Dropdown */}
                                {showColorPicker && (
                                    <div className="absolute top-full right-0 mt-2 p-3 bg-card rounded-xl shadow-xl border border-border z-10 min-w-[200px]">
                                        <p className="text-xs font-medium text-muted-foreground mb-2">Choose Background:</p>
                                        <div className="grid grid-cols-4 gap-2">
                                            {BACKGROUND_COLORS.map((color) => (
                                                <button
                                                    key={color.id}
                                                    onClick={() => {
                                                        handleBackgroundChange(color.value);
                                                        setShowColorPicker(false);
                                                    }}
                                                    className={cn(
                                                        "w-10 h-10 rounded-lg border-2 transition-all",
                                                        color.preview,
                                                        backgroundColor === color.value
                                                            ? "border-primary ring-2 ring-primary/20"
                                                            : "border-border hover:border-muted-foreground"
                                                    )}
                                                    title={color.label}
                                                />
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-2 text-center">
                                            {backgroundColor === 'transparent' ? '✓ Transparent (PNG)' : '✓ Solid Background'}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="w-px h-6 bg-border" />

                            {/* Undo */}
                            <button
                                onClick={undo}
                                disabled={historyIndex <= 0}
                                className={cn(
                                    "p-2 rounded-lg transition-all",
                                    historyIndex > 0
                                        ? "bg-muted hover:bg-muted/80 text-muted-foreground"
                                        : "bg-muted/50 text-muted-foreground/50 cursor-not-allowed"
                                )}
                                title="Undo"
                            >
                                <Undo className="w-4 h-4" />
                            </button>

                            {/* Clear */}
                            <button
                                onClick={handleClear}
                                className="p-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 transition-all"
                                title="Clear"
                            >
                                <Eraser className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Canvas Area */}
                <div className="p-6 bg-surface">
                    <div 
                        className={cn(
                            "relative rounded-xl border-2 border-dashed border-border overflow-hidden",
                            backgroundColor === 'transparent' && "bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%3E%3Crect%20width%3D%228%22%20height%3D%228%22%20fill%3D%22%23e5e5e5%22%2F%3E%3Crect%20x%3D%228%22%20y%3D%228%22%20width%3D%228%22%20height%3D%228%22%20fill%3D%22%23e5e5e5%22%2F%3E%3Crect%20x%3D%228%22%20width%3D%228%22%20height%3D%228%22%20fill%3D%22%23fff%22%2F%3E%3Crect%20y%3D%228%22%20width%3D%228%22%20height%3D%228%22%20fill%3D%22%23fff%22%2F%3E%3C%2Fsvg%3E')]"
                        )}
                        style={{
                            backgroundColor: backgroundColor === 'transparent' ? 'transparent' : backgroundColor,
                        }}
                    >
                        <canvas
                            ref={canvasRef}
                            className="w-full h-[200px] cursor-crosshair touch-none"
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                        />
                        
                        {/* Placeholder text when empty */}
                        {historyIndex <= 0 && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <p className="text-muted-foreground text-lg font-medium">
                                    Draw your signature here...
                                </p>
                            </div>
                        )}
                    </div>
                    
                    <p className="text-xs text-muted-foreground text-center mt-3">
                        Use your mouse or finger to draw. Your signature will be saved as a {backgroundColor === 'transparent' ? 'transparent PNG' : 'PNG image'}.
                    </p>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/50">
                    <Button
                        variant="outline"
                        onClick={onClose}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        className="bg-primary hover:bg-primary/90 text-white gap-2"
                    >
                        <Check className="w-4 h-4" />
                        Save Signature
                    </Button>
                </div>
            </div>
        </div>
    );
}
