import { cn } from '@/lib/utils';

interface CheckboxProps {
    id: string;
    slug: string;
    value: boolean;
    onChange: (slug: string, value: boolean) => void;
    scale: number;
    width: number;
    height: number;
}

export function Checkbox({ id, slug, value, onChange, scale, width, height }: CheckboxProps) {
    // Mathematical precision for consistent rendering
    const boxSize = Math.min(width, height) * scale;
    const borderWidth = Math.max(1, boxSize * 0.1);
    const checkSize = boxSize * 0.7;

    return (
        <div
            className="w-full h-full flex items-center justify-center cursor-pointer"
            onClick={() => onChange(slug, !value)}
        >
            <div
                style={{
                    width: `${boxSize}px`,
                    height: `${boxSize}px`,
                    border: `${borderWidth}px solid #000`,
                    boxSizing: 'border-box',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background-color 0.2s',
                    backgroundColor: value ? '#000' : 'transparent',
                }}
            >
                {value && (
                    <svg
                        width={checkSize}
                        height={checkSize}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#fff"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                )}
            </div>
        </div>
    );
}
