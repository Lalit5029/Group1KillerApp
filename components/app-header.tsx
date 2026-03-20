import { Loader2, GraduationCap } from "lucide-react"

interface AppHeaderProps {
  selectedMajor: string
  selectedYear: string
  isLoading: boolean
  studentName?: string
}

export function AppHeader({ selectedMajor, selectedYear, isLoading, studentName }: AppHeaderProps) {
  return (
    <header className="flex flex-wrap justify-between items-center mb-6 p-5 bg-gradient-to-r from-primary-600 to-secondary rounded-xl shadow-soft text-white">
      <div className="flex items-center gap-3">
        <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm">
          <GraduationCap className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Academic Planner</h1>
          {studentName ? <p className="text-xs text-white/80">Student: {studentName}</p> : null}
        </div>
      </div>

      <div className="flex-grow text-center">
        {selectedMajor && selectedYear ? (
          <p className="text-lg font-medium bg-white/20 px-4 py-1 rounded-full inline-block backdrop-blur-sm">
            <span className="font-semibold">{selectedMajor}</span>
            <span className="mx-2 opacity-80">•</span>
            <span>{selectedYear}</span>
          </p>
        ) : (
          <p className="text-lg italic opacity-80">
            Select <span className="font-semibold">Major &amp; Year</span> using the button below to personalize requirements.
          </p>
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
