"use client";

import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Pagination({ currentPage, totalPages, onPageChange, maxDisplayed = 5 }) {
  // Don't render pagination if there's only 1 page
  if (totalPages <= 1) {
    return null;
  }

  // Calculate range of page numbers to display
  const createPageNumbers = () => {
    const pageNumbers = [];
    const halfMaxDisplayed = Math.floor(maxDisplayed / 2);
    
    let startPage = Math.max(currentPage - halfMaxDisplayed, 1);
    let endPage = startPage + maxDisplayed - 1;
    
    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = Math.max(totalPages - maxDisplayed + 1, 1);
    }
    
    // Add first page with ellipsis if needed
    if (startPage > 1) {
      pageNumbers.push(1);
      if (startPage > 2) {
        pageNumbers.push("ellipsis-start");
      }
    }
    
    // Add page numbers
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }
    
    // Add last page with ellipsis if needed
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pageNumbers.push("ellipsis-end");
      }
      pageNumbers.push(totalPages);
    }
    
    return pageNumbers;
  };
  
  const pageNumbers = createPageNumbers();

  return (
    <div className="flex items-center justify-center space-x-1">
      <Button
        variant="outline"
        size="icon"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        <ChevronLeftIcon className="h-4 w-4" />
        <span className="sr-only">Previous page</span>
      </Button>
      
      {pageNumbers.map((page, index) => {
        if (page === "ellipsis-start" || page === "ellipsis-end") {
          return (
            <Button
              key={`ellipsis-${index}`}
              variant="outline"
              size="icon"
              disabled
              className="cursor-default"
            >
              <MoreHorizontalIcon className="h-4 w-4" />
              <span className="sr-only">More pages</span>
            </Button>
          );
        }
        
        return (
          <Button
            key={page}
            variant={currentPage === page ? "default" : "outline"}
            size="icon"
            onClick={() => onPageChange(page)}
          >
            {page}
            <span className="sr-only">Page {page}</span>
          </Button>
        );
      })}
      
      <Button
        variant="outline"
        size="icon"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        <ChevronRightIcon className="h-4 w-4" />
        <span className="sr-only">Next page</span>
      </Button>
    </div>
  );
} 