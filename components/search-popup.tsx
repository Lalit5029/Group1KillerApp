// "use client"

// import type React from "react"

// import { useState } from "react"
// import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
// import { Input } from "@/components/ui/input"
// import { Button } from "@/components/ui/button"
// import { Search, Plus } from "lucide-react"
// import type { Course } from "@/lib/types"

// interface SearchPopupProps {
//   onClose: () => void
//   onSearch: (query: string) => void
//   searchResults: Course[]
//   onAddCourse: (course: Course) => void
// }

// export function SearchPopup({ onClose, onSearch, searchResults, onAddCourse }: SearchPopupProps) {
//   const [searchQuery, setSearchQuery] = useState("")

//   const handleSearch = (e: React.FormEvent) => {
//     e.preventDefault()
//     onSearch(searchQuery)
//   }

//   const handleKeyDown = (e: React.KeyboardEvent) => {
//     if (e.key === "Enter") {
//       onSearch(searchQuery)
//     }
//   }

//   return (
//     <Dialog open={true} onOpenChange={() => onClose()}>
//       <DialogContent className="sm:max-w-[650px]">
//         <DialogHeader>
//           <DialogTitle className="flex items-center gap-2">
//             <Search className="h-5 w-5 text-primary" />
//             Search Courses
//           </DialogTitle>
//         </DialogHeader>

//         <form onSubmit={handleSearch} className="mt-4">
//           <div className="relative">
//             <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
//             <Input
//               placeholder="Search by Course Code or Instructor Name and press Enter..."
//               value={searchQuery}
//               onChange={(e) => setSearchQuery(e.target.value)}
//               onKeyDown={handleKeyDown}
//               className="pl-10 bg-white border-2 border-primary-200 focus:border-primary focus:ring-2 focus:ring-primary-100"
//             />
//             <Button
//               type="submit"
//               className="absolute right-1 top-1/2 transform -translate-y-1/2 bg-primary hover:bg-primary-600"
//             >
//               Search
//             </Button>
//           </div>
//         </form>

//         <div className="mt-4 max-h-[350px] overflow-y-auto border rounded-md border-gray-200">
//           {searchResults.length === 0 ? (
//             <p className="text-center text-muted-foreground py-8 bg-gray-50">
//               {searchQuery ? "No courses found matching your search." : "Enter a search term to find courses."}
//             </p>
//           ) : (
//             <div className="space-y-2 p-2">
//               {searchResults.map((course, index) => (
//                 <div
//                   key={`${course.Class}-${course.Section}-${index}`}
//                   className={`flex justify-between items-center p-3 rounded-md ${getDepartmentClass(course.Class)} hover:shadow-md transition-shadow`}
//                 >
//                   <div>
//                     <div className="font-medium">
//                       {course.Class} {course.Section}
//                     </div>
//                     <div className="text-sm text-muted-foreground">
//                       {course.DaysTimes || "TBA"} - {course.Instructor || "N/A"}
//                     </div>
//                     <div className="text-xs text-muted-foreground">{course.Room || "TBA"}</div>
//                   </div>
//                   <Button
//                     size="sm"
//                     onClick={() => onAddCourse(course)}
//                     className="flex items-center gap-1 bg-primary hover:bg-primary-600"
//                   >
//                     <Plus className="h-4 w-4" />
//                     Add
//                   </Button>
//                 </div>
//               ))}
//             </div>
//           )}
//         </div>
//       </DialogContent>
//     </Dialog>
//   )
// }

// // Helper function to get department styling class
// function getDepartmentClass(className?: string): string {
//   if (!className) return "bg-gray-100"

//   const deptCode = getDepartmentCode(className)

//   const deptColors: Record<string, string> = {
//     BEN: "bg-blue-50 border-l-4 border-blue-500",
//     CSE: "bg-green-50 border-l-4 border-green-500",
//     MAE: "bg-red-50 border-l-4 border-red-500",
//     CEN: "bg-yellow-50 border-l-4 border-yellow-500",
//     CEE: "bg-purple-50 border-l-4 border-purple-500",
//     ELE: "bg-teal-50 border-l-4 border-teal-500",
//     MAT: "bg-orange-50 border-l-4 border-orange-500",
//     PHY: "bg-indigo-50 border-l-4 border-indigo-500",
//     CHE: "bg-emerald-50 border-l-4 border-emerald-500",
//     ECS: "bg-cyan-50 border-l-4 border-cyan-500",
//     AEE: "bg-rose-50 border-l-4 border-rose-500",
//     WRT: "bg-gray-50 border-l-4 border-gray-500",
//   }

//   return deptColors[deptCode] || "bg-gray-100"
// }

"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus } from "lucide-react"
import type { Course } from "@/lib/types"
import { getDepartmentCode } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { get } from "http"

interface SearchPopupProps {
  onClose: () => void
  onSearch: (query: string) => void
  searchResults: Course[]
  onAddCourse: (course: Course) => void
}

export function SearchPopup({ onClose, onSearch, searchResults, onAddCourse }: SearchPopupProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch(searchQuery)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onSearch(searchQuery)
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Search Courses
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSearch} className="mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search by Course Code or Instructor Name and press Enter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-10 bg-white border-2 border-primary-200 focus:border-primary focus:ring-2 focus:ring-primary-100"
            />
            <Button
              type="submit"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 bg-primary hover:bg-primary-600"
            >
              Search
            </Button>
          </div>
        </form>

        <div className="mt-4 max-h-[350px] overflow-y-auto border rounded-md border-gray-200">
          {searchResults.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 bg-gray-50">
              {searchQuery ? "No courses found matching your search." : "Enter a search term to find courses."}
            </p>
          ) : (
            <div className="space-y-2 p-2">
              {searchResults.map((course, index) => (
                <div
                  key={`${course.Class}-${course.Section}-${index}`}
                  className={`flex justify-between items-center p-3 rounded-md ${getDepartmentCode(course.Class)} hover:shadow-md transition-shadow`}
                >
                  <div>
                    <div className="font-medium">
                      {course.Class} {course.Section}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {course.DaysTimes || "TBA"} - 
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>

                            <span className="ml-1 px-2 py-1 rounded-md bg-gray-100  border-primary hover:bg-gray-200 transition-colors cursor-pointer inline-flex items-center gap-1 border border-gray-300">
                              {course.Instructor || "N/A"}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[300px]">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold">{course.Instructor}</h4>
                                <p className="text-sm">Rating: {course.RMP_Rating || "N/A"}/5</p>
                              </div>
                              {course.Reviews?.length ? (
                                <ul className="list-disc pl-4 space-y-1">
                                  {course.Reviews.map((review, i) => (
                                    <li key={i}>{review}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p>No reviews yet</p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="text-xs text-muted-foreground">{course.Room || "TBA"}</div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => onAddCourse(course)}
                    className="flex items-center gap-1 bg-primary hover:bg-primary-600"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}