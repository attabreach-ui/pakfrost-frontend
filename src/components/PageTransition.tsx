import { motion, AnimatePresence } from 'framer-motion';
import type { ReactNode } from 'react';

interface PageTransitionProps {
  pageKey: string;
  children: ReactNode;
}

export default function PageTransition({ pageKey, children }: PageTransitionProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pageKey}
        className="flex-1 flex flex-col overflow-hidden"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
