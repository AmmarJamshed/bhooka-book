"use client";

/** Quick cuisine filter chips */

import Link from "next/link";
import { motion } from "framer-motion";
import { QUICK_FILTERS } from "@/types";

export function QuickFilters() {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {QUICK_FILTERS.map((filter, i) => (
        <motion.div
          key={filter.slug}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.03 }}
        >
          <Link
            href={`/search?category=${filter.slug}`}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-primary/20 bg-white/70 px-4 py-2 text-sm font-medium text-accent backdrop-blur transition-all hover:border-primary hover:bg-primary/5 hover:text-primary"
          >
            <span>{filter.icon}</span>
            {filter.label}
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
