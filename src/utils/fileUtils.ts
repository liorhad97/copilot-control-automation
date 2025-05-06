/**
 * File Utilities
 * Common functions for file operations and JSON handling
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Validates a JSON file structure against expected schema
 * @param filePath Path to the JSON file
 * @returns True if valid, false otherwise
 */
export async function validateJsonFile(filePath: string): Promise<boolean> {
    try {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return false;
        }

        // Read and parse the file
        const fileContent = await fs.promises.readFile(filePath, 'utf8');
        const jsonContent = JSON.parse(fileContent);

        // Check for expected structure (tasks array with required fields)
        if (!jsonContent.tasks || !Array.isArray(jsonContent.tasks)) {
            return false;
        }

        // Check each task has required fields
        for (const task of jsonContent.tasks) {
            if (!task.id || !task.name || !task.description || !task.status) {
                return false;
            }
        }

        return true;
    } catch (error) {
        console.error('Error validating JSON file:', error);
        return false;
    }
}

/**
 * Checks if a file exists at the specified path
 * @param filePath Path to check
 * @returns True if file exists, false otherwise
 */
export function fileExists(filePath: string): boolean {
    try {
        return fs.existsSync(filePath);
    } catch (error) {
        console.error('Error checking if file exists:', error);
        return false;
    }
}

/**
 * Gets the workspace root path
 * @returns Workspace root path or null if no workspace is open
 */
export function getWorkspaceRootPath(): string | null {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return null;
    }
    return workspaceFolders[0].uri.fsPath;
}

/**
 * Builds a path relative to the workspace root
 * @param relativePath Path relative to workspace root
 * @returns Full path or null if no workspace is open
 */
export function getWorkspacePath(relativePath: string): string | null {
    const rootPath = getWorkspaceRootPath();
    if (!rootPath) {
        return null;
    }
    return path.join(rootPath, relativePath);
}
