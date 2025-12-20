"use client";

import { motion } from "framer-motion";

interface LogoProps {
    className?: string;
    size?: number;
    animated?: boolean;
}

export function Logo({ className = "", size = 40, animated = true }: LogoProps) {
    // Cosmic Luxury Palette
    // Amber: #d4a574
    // Pale Gold: #e8d5a3
    // Soft Lime: #c8d86a
    // Cream: #f5efe4

    return (
        <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
            <svg
                width={size}
                height={size}
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="overflow-visible"
            >
                <defs>
                    <radialGradient id="core-glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(50 50) rotate(90) scale(40)">
                        <stop offset="0%" stopColor="#d4a574" stopOpacity="0.9" />
                        <stop offset="60%" stopColor="#c9956c" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#d4a574" stopOpacity="0" />
                    </radialGradient>
                    <linearGradient id="ring-gradient" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#e8d5a3" stopOpacity="0.8" />
                        <stop offset="50%" stopColor="#d4a574" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#f5efe4" stopOpacity="0.8" />
                    </linearGradient>
                    <filter id="glow-blur" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Outer Orbit Ring */}
                <motion.path
                    d="M50 10 C 72.091 10 90 27.909 90 50 C 90 72.091 72.091 90 50 90 C 27.909 90 10 72.091 10 50 C 10 27.909 27.909 10 50 10 Z"
                    stroke="url(#ring-gradient)"
                    strokeWidth="1.5"
                    fill="none"
                    initial={animated ? { rotate: 0, scale: 0.95, opacity: 0 } : false}
                    animate={animated ? { rotate: 360, scale: 1, opacity: 1 } : false}
                    transition={{
                        rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                        scale: { duration: 0.5 },
                        opacity: { duration: 0.5 }
                    }}
                    style={{ transformOrigin: "center" }}
                />

                {/* Inner Tilted Orbit */}
                <motion.ellipse
                    cx="50"
                    cy="50"
                    rx="38"
                    ry="14"
                    stroke="#f5efe4"
                    strokeWidth="1"
                    strokeOpacity="0.4"
                    fill="none"
                    initial={animated ? { rotate: -45 } : { rotate: -45 }}
                    animate={animated ? { rotate: [-45, 315] } : false} // -45 + 360 = 315
                    transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                    style={{ transformOrigin: "center" }}
                />

                {/* Central Core */}
                <motion.circle
                    cx="50"
                    cy="50"
                    r="16"
                    fill="url(#core-glow)"
                    filter="url(#glow-blur)"
                    initial={animated ? { scale: 0.8, opacity: 0 } : false}
                    animate={animated ? { scale: [1, 1.1, 1], opacity: 1 } : false}
                    transition={{
                        scale: { duration: 3, repeat: Infinity, ease: "easeInOut" },
                        opacity: { duration: 0.5 }
                    }}
                />

                {/* Solid Core Center */}
                <circle cx="50" cy="50" r="6" fill="#f5efe4" fillOpacity="0.9" />

                {/* Orbiting Particle */}
                <motion.circle
                    cx="50"
                    cy="10"
                    r="3"
                    fill="#c8d86a"
                    initial={animated ? { rotate: 0 } : false}
                    animate={animated ? { rotate: 360 } : false}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    style={{ transformOrigin: "50px 50px" }} // Rotate around center
                />
            </svg>
        </div>
    );
}
