import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Read the requirements data from the backend/data directory
    const filePath = path.join(process.cwd(), 'backend', 'data', 'ecs_requirements_cleaned.json');
    
    if (!fs.existsSync(filePath)) {
      console.error(`File does not exist: ${filePath}`);
      return NextResponse.json(
        { error: 'Requirements data file not found' },
        { status: 404 }
      );
    }
    
    const fileData = fs.readFileSync(filePath, 'utf8');
    const reqData = JSON.parse(fileData);
    
    // Create a map of requirements by major (reqData is an array of programs)
    const requirementsByMajor = {};
    reqData.forEach(program => {
      if (program.program) {
        requirementsByMajor[program.program] = program;
      }
    });
    
    console.log(`Loaded requirements for ${Object.keys(requirementsByMajor).length} majors`);
    
    // Return the structured data
    return NextResponse.json(requirementsByMajor);
  } catch (error) {
    console.error('Error loading requirements data:', error);
    return NextResponse.json(
      { error: 'Failed to load major requirements data: ' + error.message },
      { status: 500 }
    );
  }
} 