"use client";

import React from "react";
import { motion, Variants } from "framer-motion";

interface StaggerGridProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}

const gridVariants: Variants = {
  hidden: { opacity: 0 },
  visible: (staggerDelay = 0.05) => ({
    opacity: 1,
    transition: {
      staggerChildren: staggerDelay,
      delayChildren: 0.02,
    },
  }),
};

export function StaggerGrid({
  children,
  className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6",
  staggerDelay = 0.05,
}: StaggerGridProps) {
  return (
    <motion.div
      className={className}
      variants={gridVariants}
      custom={staggerDelay}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.25, 0.1, 0.25, 1], // easeOut cubic
    },
  },
};

interface StaggerItemProps {
  children: React.ReactNode;
  className?: string;
}

export function StaggerItem({ children, className = "" }: StaggerItemProps) {
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}
