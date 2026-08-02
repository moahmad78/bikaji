import fs from "fs";
import path from "path";

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

function auditLucideImports() {
  console.log("🔍 Auditing all 'lucide-react' imports across src/...");
  const files = getAllFiles(path.join(process.cwd(), "src"));

  let deepImportsFound = 0;
  let duplicateImportsFound = 0;
  let serverComponentIconIssues = 0;

  files.forEach((file) => {
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split("\n");

    let lucideImportCount = 0;

    lines.forEach((line, index) => {
      if (line.includes("lucide-react")) {
        lucideImportCount++;

        // Check 1: Deep imports
        if (line.includes("lucide-react/") || line.includes("lucide-react/dist")) {
          console.error(`❌ Deep import found in ${file}:${index + 1}: ${line.trim()}`);
          deepImportsFound++;
        }

        // Check 2: Invalid syntax
        if (!line.includes("from \"lucide-react\"") && !line.includes("from 'lucide-react'")) {
          console.warn(`⚠️ Non-standard import format in ${file}:${index + 1}: ${line.trim()}`);
        }
      }
    });

    if (lucideImportCount > 1) {
      console.warn(`⚠️ Multiple lucide-react import statements in ${file}`);
      duplicateImportsFound++;
    }
  });

  console.log("");
  console.log(`Audit Summary:`);
  console.log(` - Deep Imports: ${deepImportsFound}`);
  console.log(` - Duplicate Statements: ${duplicateImportsFound}`);
  console.log("✅ Audit completed cleanly.");
}

auditLucideImports();
