import { Loader2, GraduationCap } from "lucide-react"

interface AppHeaderProps {
  selectedMajor: string
  selectedYear: string
  isLoading: boolean
}

export function AppHeader({ selectedMajor, selectedYear, isLoading }: AppHeaderProps) {
  return (
    <header className="flex flex-wrap justify-between items-center mb-6 p-5 bg-gradient-to-r from-primary-600 to-secondary rounded-xl shadow-soft text-white">
      <div className="flex items-center gap-3">
        <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm">
          <GraduationCap className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold">Academic Planner</h1>
      </div>

      <div className="flex-grow text-center">
        {selectedMajor && selectedYear ? (
          <p className="text-lg font-medium bg-white/20 px-4 py-1 rounded-full inline-block backdrop-blur-sm">
            {selectedMajor} - {selectedYear}
          </p>
        ) : (
          <p className="text-lg italic opacity-80">Please make selection in popup.</p>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading Courses...</span>
        </div>
      )}
    </header>
  )
}
