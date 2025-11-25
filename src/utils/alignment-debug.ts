/**
 * COMPREHENSIVE CROSS-VIEW ALIGNMENT DEBUGGING SYSTEM
 * Beast Mode 4.0 - Advanced Troubleshooting Workflow for React/Next.js Drag-and-Drop
 * 
 * Addresses: Edit Mode → Preview Mode → PDF Generation alignment inconsistencies
 */

export interface FieldPosition {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    mode: 'edit' | 'preview' | 'pdf';
    timestamp: number;
}

export interface AlignmentReport {
    fieldId: string;
    editPosition: FieldPosition;
    previewPosition: FieldPosition;
    pdfPosition?: FieldPosition;
    alignment: {
        xOffset: number;
        yOffset: number;
        severity: 'low' | 'medium' | 'high' | 'critical';
    };
    issues: string[];
    recommendations: string[];
}

export class AlignmentDebugger {
    private positions: Map<string, FieldPosition[]> = new Map();
    private toleranceThreshold = 3; // pixels
    
    constructor() {
        this.initializeGlobalTracking();
    }

    /**
     * PHASE 1: REAL-TIME POSITION TRACKING
     * Record positions across all three views for comparison
     */
    recordPosition(fieldId: string, position: Omit<FieldPosition, 'id' | 'timestamp'>) {
        const positionRecord: FieldPosition = {
            id: fieldId,
            timestamp: Date.now(),
            ...position
        };

        if (!this.positions.has(fieldId)) {
            this.positions.set(fieldId, []);
        }

        const fieldPositions = this.positions.get(fieldId)!;
        
        // Remove old positions of the same mode
        const filteredPositions = fieldPositions.filter(p => p.mode !== position.mode);
        filteredPositions.push(positionRecord);
        
        this.positions.set(fieldId, filteredPositions);
        
        console.log(`🎯 Position recorded for ${fieldId} in ${position.mode} mode:`, positionRecord);
        
        // Auto-analyze if we have both edit and preview positions
        this.autoAnalyze(fieldId);
    }

    /**
     * PHASE 2: COORDINATE SYSTEM ANALYSIS
     * Analyze coordinate transformations between views
     */
    analyzeCoordinateSystem(fieldId: string): AlignmentReport | null {
        const positions = this.positions.get(fieldId);
        if (!positions || positions.length < 2) return null;

        const editPos = positions.find(p => p.mode === 'edit');
        const previewPos = positions.find(p => p.mode === 'preview');
        const pdfPos = positions.find(p => p.mode === 'pdf');

        if (!editPos || !previewPos) return null;

        const xOffset = Math.abs(editPos.x - previewPos.x);
        const yOffset = Math.abs(editPos.y - previewPos.y);
        
        const severity = this.calculateSeverity(xOffset, yOffset);
        
        const issues: string[] = [];
        const recommendations: string[] = [];

        // Detect common alignment issues
        this.detectCommonIssues(editPos, previewPos, pdfPos, issues, recommendations);

        return {
            fieldId,
            editPosition: editPos,
            previewPosition: previewPos,
            pdfPosition: pdfPos,
            alignment: {
                xOffset,
                yOffset,
                severity
            },
            issues,
            recommendations
        };
    }

    /**
     * PHASE 3: CSS BOX MODEL VALIDATOR
     * Inspect and validate CSS box model across views
     */
    validateBoxModel(element: HTMLElement, expectedPosition: { x: number; y: number }): {
        isValid: boolean;
        computedStyles: CSSStyleDeclaration;
        boxModel: {
            margin: DOMRect;
            border: DOMRect;
            padding: DOMRect;
            content: DOMRect;
        };
        issues: string[];
    } {
        const computedStyles = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        
        const issues: string[] = [];
        
        // Check for common box model issues
        if (computedStyles.margin !== '0px') {
            issues.push(`Unexpected margin: ${computedStyles.margin}`);
        }
        
        if (computedStyles.padding !== '0px' && !computedStyles.padding.startsWith('0px 2px')) {
            issues.push(`Unexpected padding: ${computedStyles.padding}`);
        }
        
        if (computedStyles.boxSizing !== 'border-box') {
            issues.push(`Box sizing should be border-box, got: ${computedStyles.boxSizing}`);
        }
        
        if (computedStyles.transformOrigin !== '0px 0px') {
            issues.push(`Transform origin should be 0 0, got: ${computedStyles.transformOrigin}`);
        }

        // Calculate actual vs expected position
        const actualX = rect.left;
        const actualY = rect.top;
        
        if (Math.abs(actualX - expectedPosition.x) > this.toleranceThreshold) {
            issues.push(`X position mismatch: expected ${expectedPosition.x}, got ${actualX}`);
        }
        
        if (Math.abs(actualY - expectedPosition.y) > this.toleranceThreshold) {
            issues.push(`Y position mismatch: expected ${expectedPosition.y}, got ${actualY}`);
        }

        return {
            isValid: issues.length === 0,
            computedStyles,
            boxModel: this.calculateBoxModel(rect, computedStyles),
            issues
        };
    }

    /**
     * PHASE 4: SCALING AND VIEWPORT ANALYSIS
     * Analyze zoom/scale effects on positioning
     */
    analyzeScaling(editScale: number, previewScale: number, fieldPositions: {
        editX: number;
        editY: number;
        previewX: number;
        previewY: number;
    }): {
        scaleRatio: number;
        expectedPreviewX: number;
        expectedPreviewY: number;
        actualOffset: { x: number; y: number };
        isScalingCorrect: boolean;
        issues: string[];
    } {
        const scaleRatio = previewScale / editScale;
        const expectedPreviewX = fieldPositions.editX * scaleRatio;
        const expectedPreviewY = fieldPositions.editY * scaleRatio;
        
        const actualOffset = {
            x: fieldPositions.previewX - expectedPreviewX,
            y: fieldPositions.previewY - expectedPreviewY
        };
        
        const issues: string[] = [];
        
        if (Math.abs(actualOffset.x) > this.toleranceThreshold) {
            issues.push(`X scaling incorrect: offset ${actualOffset.x}px`);
        }
        
        if (Math.abs(actualOffset.y) > this.toleranceThreshold) {
            issues.push(`Y scaling incorrect: offset ${actualOffset.y}px`);
        }
        
        return {
            scaleRatio,
            expectedPreviewX,
            expectedPreviewY,
            actualOffset,
            isScalingCorrect: issues.length === 0,
            issues
        };
    }

    /**
     * PHASE 5: BROWSER DEVELOPER TOOLS INTEGRATION
     * Generate debugging commands for developer console
     */
    generateDebugCommands(fieldId: string): string[] {
        return [
            `// === ALIGNMENT DEBUG COMMANDS FOR FIELD ${fieldId} ===`,
            ``,
            `// 1. Inspect all field elements`,
            `document.querySelectorAll('[data-field-id="${fieldId}"]').forEach((el, i) => {`,
            `  console.log(\`Mode \${i}:\`, {`,
            `    element: el,`,
            `    rect: el.getBoundingClientRect(),`,
            `    styles: window.getComputedStyle(el),`,
            `    parent: el.parentElement?.getBoundingClientRect()`,
            `  });`,
            `});`,
            ``,
            `// 2. Check transform matrices`,
            `document.querySelectorAll('[data-field-id="${fieldId}"]').forEach(el => {`,
            `  const transform = window.getComputedStyle(el).transform;`,
            `  console.log('Transform matrix:', transform);`,
            `});`,
            ``,
            `// 3. Measure container offsets`,
            `const containers = document.querySelectorAll('.pdf-container, .preview-container');`,
            `containers.forEach((container, i) => {`,
            `  console.log(\`Container \${i}:\`, {`,
            `    offset: container.getBoundingClientRect(),`,
            `    scroll: { x: container.scrollLeft, y: container.scrollTop }`,
            `  });`,
            `});`,
            ``,
            `// 4. Check precision calculations`,
            `const precisionFactor = 1000000;`,
            `console.log('Precision test:', {`,
            `  input: 123.456789123456,`,
            `  rounded: Math.round(123.456789123456 * precisionFactor) / precisionFactor`,
            `});`
        ];
    }

    /**
     * PHASE 6: AUTOMATED FIX SUGGESTIONS
     * Generate automated fixes based on detected issues
     */
    generateFixes(report: AlignmentReport): {
        cssFixes: string[];
        codeFixes: string[];
        configFixes: string[];
    } {
        const cssFixes: string[] = [];
        const codeFixes: string[] = [];
        const configFixes: string[] = [];

        // Analyze patterns in issues
        if (report.issues.includes('downward shift')) {
            cssFixes.push(`
/* Fix downward shift in preview */
.preview-field {
  align-items: flex-start !important;
  vertical-align: top !important;
  line-height: 1 !important;
  padding-top: 0 !important;
  margin-top: 0 !important;
}
            `);
        }

        if (report.issues.includes('rightward shift')) {
            cssFixes.push(`
/* Fix rightward shift after save */
.pdf-field {
  text-align: left !important;
  padding-left: 2px !important;
  transform-origin: 0 0 !important;
}
            `);
        }

        if (report.alignment.yOffset > 5) {
            codeFixes.push(`
// Synchronize baseline calculations
const baselineOffset = fontSize * 0.2; // Adjust based on font metrics
const correctedY = originalY - baselineOffset;
            `);
        }

        return { cssFixes, codeFixes, configFixes };
    }

    /**
     * REAL-TIME ALIGNMENT VALIDATOR v2.0
     * Continuously monitor and validate positioning across views
     */
    validateRealTime(fieldId: string, currentPosition: Omit<FieldPosition, 'id' | 'timestamp'>) {
        const positions = this.positions.get(fieldId) || [];
        const lastPosition = positions.find(p => p.mode === currentPosition.mode);
        
        if (lastPosition) {
            const xDrift = Math.abs(currentPosition.x - lastPosition.x);
            const yDrift = Math.abs(currentPosition.y - lastPosition.y);
            
            if (xDrift > this.toleranceThreshold || yDrift > this.toleranceThreshold) {
                console.warn(`🚨 Position drift detected for field ${fieldId}:`, {
                    mode: currentPosition.mode,
                    drift: { x: xDrift, y: yDrift },
                    tolerance: this.toleranceThreshold,
                    oldPosition: { x: lastPosition.x, y: lastPosition.y },
                    newPosition: { x: currentPosition.x, y: currentPosition.y }
                });
                
                return {
                    isValid: false,
                    drift: { x: xDrift, y: yDrift },
                    recommendation: this.generateDriftFix(xDrift, yDrift)
                };
            }
        }
        
        // Record the new position
        this.recordPosition(fieldId, currentPosition);
        return { isValid: true, drift: { x: 0, y: 0 }, recommendation: '' };
    }

    /**
     * CROSS-VIEW CONSISTENCY CHECKER v2.0
     * Compare positions between different views and detect discrepancies
     */
    validateCrossViewConsistency(fieldId: string): {
        isConsistent: boolean;
        issues: string[];
        fixes: string[];
    } {
        const positions = this.positions.get(fieldId);
        if (!positions || positions.length < 2) {
            return { isConsistent: true, issues: [], fixes: [] };
        }

        const editPos = positions.find(p => p.mode === 'edit');
        const previewPos = positions.find(p => p.mode === 'preview');
        const pdfPos = positions.find(p => p.mode === 'pdf');

        const issues: string[] = [];
        const fixes: string[] = [];

        // Check edit to preview consistency
        if (editPos && previewPos) {
            const xOffset = Math.abs(editPos.x - previewPos.x);
            const yOffset = Math.abs(editPos.y - previewPos.y);

            if (yOffset > this.toleranceThreshold) {
                issues.push(`Preview mode Y offset: ${yOffset.toFixed(2)}px`);
                if (previewPos.y > editPos.y) {
                    fixes.push('Add CSS: align-items: flex-start; line-height: 1;');
                } else {
                    fixes.push('Add CSS: padding-top: 0px; margin-top: 0px;');
                }
            }

            if (xOffset > this.toleranceThreshold) {
                issues.push(`Preview mode X offset: ${xOffset.toFixed(2)}px`);
                fixes.push('Check text-align and padding-left consistency');
            }
        }

        // Check preview to PDF consistency
        if (previewPos && pdfPos) {
            const xOffset = Math.abs(previewPos.x - pdfPos.x);
            const yOffset = Math.abs(previewPos.y - pdfPos.y);

            if (yOffset > this.toleranceThreshold) {
                issues.push(`PDF generation Y offset: ${yOffset.toFixed(2)}px`);
                fixes.push('Synchronize baseline calculation between preview and PDF');
            }

            if (xOffset > this.toleranceThreshold) {
                issues.push(`PDF generation X offset: ${xOffset.toFixed(2)}px`);
                fixes.push('Check padding and text alignment in PDF generation');
            }
        }

        return {
            isConsistent: issues.length === 0,
            issues,
            fixes
        };
    }

    private generateDriftFix(xDrift: number, yDrift: number): string {
        if (yDrift > xDrift) {
            return 'Vertical drift detected. Check for dynamic line-height or margin changes.';
        } else if (xDrift > yDrift) {
            return 'Horizontal drift detected. Check for text alignment or padding changes.';
        }
        return 'General position drift. Check for scale or container size changes.';
    }
    generateDebugReport(): string {
        const reports = Array.from(this.positions.keys())
            .map(fieldId => this.analyzeCoordinateSystem(fieldId))
            .filter(Boolean) as AlignmentReport[];

        if (reports.length === 0) {
            return "No alignment data available. Please interact with fields first.";
        }

        let report = "# 🎯 CROSS-VIEW ALIGNMENT DEBUGGING REPORT\n\n";
        
        reports.forEach((fieldReport, index) => {
            report += `## Field ${index + 1}: ${fieldReport.fieldId}\n\n`;
            report += `**Alignment Offset:** ${fieldReport.alignment.xOffset.toFixed(2)}px X, ${fieldReport.alignment.yOffset.toFixed(2)}px Y\n`;
            report += `**Severity:** ${fieldReport.alignment.severity}\n\n`;
            
            report += `### Positions:\n`;
            report += `- Edit: (${fieldReport.editPosition.x.toFixed(2)}, ${fieldReport.editPosition.y.toFixed(2)})\n`;
            report += `- Preview: (${fieldReport.previewPosition.x.toFixed(2)}, ${fieldReport.previewPosition.y.toFixed(2)})\n`;
            if (fieldReport.pdfPosition) {
                report += `- PDF: (${fieldReport.pdfPosition.x.toFixed(2)}, ${fieldReport.pdfPosition.y.toFixed(2)})\n`;
            }
            
            report += `\n### Issues:\n`;
            fieldReport.issues.forEach(issue => {
                report += `- ❌ ${issue}\n`;
            });
            
            report += `\n### Recommendations:\n`;
            fieldReport.recommendations.forEach(rec => {
                report += `- ✅ ${rec}\n`;
            });
            
            report += `\n### Debug Commands:\n`;
            report += "```javascript\n";
            report += this.generateDebugCommands(fieldReport.fieldId).join('\n');
            report += "\n```\n\n";
            
            const fixes = this.generateFixes(fieldReport);
            if (fixes.cssFixes.length > 0 || fixes.codeFixes.length > 0) {
                report += `### Suggested Fixes:\n`;
                fixes.cssFixes.forEach(fix => {
                    report += "```css\n" + fix + "\n```\n\n";
                });
                fixes.codeFixes.forEach(fix => {
                    report += "```javascript\n" + fix + "\n```\n\n";
                });
            }
            
            report += "---\n\n";
        });

        return report;
    }

    // Helper methods
    private calculateSeverity(xOffset: number, yOffset: number): 'low' | 'medium' | 'high' | 'critical' {
        const maxOffset = Math.max(xOffset, yOffset);
        if (maxOffset <= 1) return 'low';
        if (maxOffset <= 3) return 'medium';
        if (maxOffset <= 5) return 'high';
        return 'critical';
    }

    private detectCommonIssues(
        editPos: FieldPosition,
        previewPos: FieldPosition,
        pdfPos: FieldPosition | undefined,
        issues: string[],
        recommendations: string[]
    ) {
        // Downward shift detection
        if (previewPos.y > editPos.y + this.toleranceThreshold) {
            issues.push('Downward shift from edit to preview mode');
            recommendations.push('Check flex alignment and line-height in preview CSS');
        }

        // Rightward shift detection  
        if (previewPos.x > editPos.x + this.toleranceThreshold) {
            issues.push('Rightward shift from edit to preview mode');
            recommendations.push('Verify text-align and padding consistency');
        }

        // PDF coordinate system issues
        if (pdfPos) {
            if (Math.abs(pdfPos.y - previewPos.y) > this.toleranceThreshold) {
                issues.push('PDF baseline calculation mismatch');
                recommendations.push('Synchronize PDF text baseline with preview form positioning');
            }
        }

        // Scale-related issues
        if (editPos.width !== previewPos.width || editPos.height !== previewPos.height) {
            issues.push('Dimension scaling inconsistency between views');
            recommendations.push('Ensure consistent scaling factors across edit/preview modes');
        }
    }

    private calculateBoxModel(rect: DOMRect, styles: CSSStyleDeclaration) {
        // This is a simplified box model calculation
        // In real implementation, you'd parse margin/border/padding values
        return {
            margin: rect,
            border: rect,
            padding: rect,
            content: rect
        };
    }

    private autoAnalyze(fieldId: string) {
        const report = this.analyzeCoordinateSystem(fieldId);
        if (report && report.alignment.severity === 'critical') {
            console.warn(`🚨 Critical alignment issue detected for field ${fieldId}:`, report);
        }
    }

    private initializeGlobalTracking() {
        // Add global CSS for debugging
        if (typeof window !== 'undefined') {
            const style = document.createElement('style');
            style.textContent = `
                .debug-field {
                    outline: 2px solid red !important;
                    background: rgba(255, 0, 0, 0.1) !important;
                }
                .debug-field::after {
                    content: attr(data-debug-info);
                    position: absolute;
                    top: -20px;
                    left: 0;
                    background: red;
                    color: white;
                    font-size: 10px;
                    padding: 2px;
                    white-space: nowrap;
                    z-index: 1000;
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * PUBLIC API METHODS
     */
    
    // Enable debug mode for a specific field
    debugField(fieldId: string) {
        if (typeof window !== 'undefined') {
            document.querySelectorAll(`[data-field-id="${fieldId}"]`).forEach(el => {
                el.classList.add('debug-field');
                el.setAttribute('data-debug-info', `Field: ${fieldId}`);
            });
        }
    }

    // Disable debug mode
    clearDebug() {
        if (typeof window !== 'undefined') {
            document.querySelectorAll('.debug-field').forEach(el => {
                el.classList.remove('debug-field');
                el.removeAttribute('data-debug-info');
            });
        }
    }

    // Reset all tracked positions
    reset() {
        this.positions.clear();
    }

    // Get current tracking data
    getTrackingData() {
        return Array.from(this.positions.entries()).map(([fieldId, positions]) => ({
            fieldId,
            positions
        }));
    }
}

// Global instance
export const alignmentDebugger = new AlignmentDebugger();

// Helper hooks for React components
export function useAlignmentTracking() {
    const recordPosition = (fieldId: string, position: Omit<FieldPosition, 'id' | 'timestamp'>) => {
        alignmentDebugger.recordPosition(fieldId, position);
    };

    const validateElement = (element: HTMLElement, expectedPosition: { x: number; y: number }) => {
        return alignmentDebugger.validateBoxModel(element, expectedPosition);
    };

    const generateReport = () => {
        return alignmentDebugger.generateDebugReport();
    };

    return {
        recordPosition,
        validateElement,
        generateReport,
        debugField: alignmentDebugger.debugField.bind(alignmentDebugger),
        clearDebug: alignmentDebugger.clearDebug.bind(alignmentDebugger),
        reset: alignmentDebugger.reset.bind(alignmentDebugger)
    };
}