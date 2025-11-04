import React from 'react';
import { SelectedCourse } from '@/lib/types';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InfoIcon, Edit3Icon, XIcon, BookOpen, MapPin, Clock, User } from "lucide-react";

interface CourseCardProps {
  course: SelectedCourse;
  position: {
    top: number;
    height: number;
  };
  hasNotes: boolean;
  onShowDetails: () => void;
  onOpenNotes: () => void;
  onRemove: () => void;
}

const CourseCard: React.FC<CourseCardProps> = ({
  course,
  position,
  hasNotes,
  onShowDetails,
  onOpenNotes,
  onRemove
}) => {
  // Extract the time from DaysTimes for display
  const timeInfo = course.DaysTimes?.match(/(\d{1,2}:\d{2}[AP]M)\s*-\s*(\d{1,2}:\d{2}[AP]M)/i);
  const startTime = timeInfo?.[1] || '';
  const endTime = timeInfo?.[2] || '';

  // Generate a background color based on the course code for visual distinction
  const getBackgroundColor = () => {
    if (!course.Class) return 'bg-gray-100';
    
    // Simple hash function to generate a color
    const courseCode = course.Class.replace(/\s+/g, '');
    let hash = 0;
    for (let i = 0; i < courseCode.length; i++) {
      hash = courseCode.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Generate a light pastel color
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 70%, 90%)`;
  };

  return (
    <Card 
      className="absolute w-[90%] left-[5%] overflow-hidden shadow-sm border border-gray-200 rounded-md"
      style={{
        top: `${position.top}%`,
        height: `${position.height}%`,
        minHeight: "60px",
        backgroundColor: getBackgroundColor(),
      }}
    >
      <CardContent className="p-2 h-full flex flex-col">
        <div className="flex items-center gap-1 mb-0.5">
          <BookOpen className="h-3 w-3 text-blue-600 flex-shrink-0" />
          <div className="text-sm font-bold truncate text-gray-900">
            {course.Class}
          </div>
        </div>
        
        <div className="flex items-center gap-1 mb-0.5">
          <Clock className="h-3 w-3 text-gray-500 flex-shrink-0" />
          <div className="text-xs text-gray-600 truncate">
            {startTime && endTime ? `${startTime} - ${endTime}` : 'Time TBA'}
          </div>
        </div>
        
        {course.Room && (
          <div className="flex items-center gap-1 mb-0.5">
            <MapPin className="h-3 w-3 text-gray-500 flex-shrink-0" />
            <div className="text-xs text-gray-600 truncate">
              {course.Room}
            </div>
          </div>
        )}
        
        {course.Instructor && (
          <div className="flex items-center gap-1 mb-0.5">
            <User className="h-3 w-3 text-gray-500 flex-shrink-0" />
            <div className="text-xs text-gray-600 truncate">
              {course.Instructor}
            </div>
          </div>
        )}
        
        <div className="mt-auto flex justify-end gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 bg-white hover:bg-gray-50" 
            onClick={onShowDetails}
            title="View details"
          >
            <InfoIcon className="h-3 w-3 text-gray-600" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className={`h-6 w-6 bg-white hover:bg-gray-50 ${hasNotes ? 'text-blue-600' : 'text-gray-600'}`} 
            onClick={onOpenNotes}
            title="Edit notes"
          >
            <Edit3Icon className="h-3 w-3" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 bg-white hover:bg-gray-50 text-red-600" 
            onClick={onRemove}
            title="Remove course"
          >
            <XIcon className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CourseCard; 