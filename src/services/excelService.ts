/**
 * Excel Service
 * Reads salary data from Excel file
 */

import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface EmployeeSalaryData {
  employeeNo: string;
  name: string;
  joinDate: string;
  empStatus: string;
  branchLocation: string;
  department: string;
  designation: string;
  fullBasic: number;
  monthlyCTC: number;
  annualCTC: number;
  daysInMonth: number;
  basic: number;
  consultancyFees: number;
  consultancyFeesArrears: number;
  overtime: number;
  reimbursementPayment: number;
  visaIncentive: number;
  gross: number;
  profTax: number;
  incomeTax: number;
  tshirtDeduction: number;
  otherDeduction: number;
  totalDeductions: number;
  netPay: number;
  confirmationDate: string;
  phone: string;
  gender: string;
}

let salaryDataCache: Map<string, EmployeeSalaryData> | null = null;
let lastLoadTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Load and parse the Excel salary file
 */
export function loadSalaryData(): Map<string, EmployeeSalaryData> {
  // Return cached data if still valid
  if (salaryDataCache && (Date.now() - lastLoadTime) < CACHE_DURATION) {
    return salaryDataCache;
  }

  try {
    // Path to the Excel file (in project root)
    const excelPath = path.join(__dirname, '../../Salary Register (53).xls');
    
    console.log('[ExcelService] Loading salary data from:', excelPath);
    
    // Read the Excel file using the correct import
    const workbook = XLSX.readFile(excelPath);
    
    // Get the first worksheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON (skip first 4 rows which are headers)
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      range: 4, // Start from row 5 (0-indexed, so row 4)
      defval: 0,
      raw: false 
    });
    
    // Create a Map for quick lookup by employee number
    const dataMap = new Map<string, EmployeeSalaryData>();
    
    jsonData.forEach((row: any) => {
      const employeeNo = String(row['EmployeeNo'] || row['__EMPTY'] || '').trim();
      
      if (employeeNo && employeeNo !== '' && employeeNo !== '0') {
        const salaryData: EmployeeSalaryData = {
          employeeNo: employeeNo,
          name: String(row['Name'] || row['__EMPTY_1'] || ''),
          joinDate: String(row['Join Date'] || row['__EMPTY_2'] || ''),
          empStatus: String(row['Emp Status'] || row['__EMPTY_3'] || ''),
          branchLocation: String(row['BranchLocation'] || row['__EMPTY_4'] || ''),
          department: String(row['Department'] || row['__EMPTY_5'] || ''),
          designation: String(row['designation'] || row['__EMPTY_6'] || ''),
          fullBasic: parseFloat(row['FULL BASIC'] || row['__EMPTY_7'] || 0),
          monthlyCTC: parseFloat(row['MONTHLY CTC'] || row['__EMPTY_8'] || 0),
          annualCTC: parseFloat(row['ANNUAL CTC'] || row['__EMPTY_9'] || 0),
          daysInMonth: parseFloat(row['DAYS IN MONTH'] || row['__EMPTY_10'] || 30),
          basic: parseFloat(row['BASIC'] || row['__EMPTY_11'] || 0),
          consultancyFees: parseFloat(row['CONSULTANCY FEES'] || row['__EMPTY_12'] || 0),
          consultancyFeesArrears: parseFloat(row['CONSULTANCY FEES Arrears'] || row['__EMPTY_13'] || 0),
          overtime: parseFloat(row['OVERTIME'] || row['__EMPTY_14'] || 0),
          reimbursementPayment: parseFloat(row['REIMBURSEMENT PAYMENT'] || row['__EMPTY_15'] || 0),
          visaIncentive: parseFloat(row['VISA INCENTIVE'] || row['__EMPTY_16'] || 0),
          gross: parseFloat(row['GROSS'] || row['__EMPTY_17'] || 0),
          profTax: parseFloat(row['PROF TAX'] || row['__EMPTY_18'] || 0),
          incomeTax: parseFloat(row['INCOME TAX'] || row['__EMPTY_19'] || 0),
          tshirtDeduction: parseFloat(row['T-SHIRT DEDUCTION'] || row['__EMPTY_20'] || 0),
          otherDeduction: parseFloat(row['OTHER DEDUCTION'] || row['__EMPTY_21'] || 0),
          totalDeductions: parseFloat(row['TOTAL DEDUCTIONS'] || row['__EMPTY_22'] || 0),
          netPay: parseFloat(row['NET PAY'] || row['__EMPTY_23'] || 0),
          confirmationDate: String(row['Confirmation Date'] || row['__EMPTY_24'] || ''),
          phone: String(row['Phone'] || row['__EMPTY_25'] || ''),
          gender: String(row['Gender'] || row['__EMPTY_26'] || ''),
        };
        
        dataMap.set(employeeNo, salaryData);
      }
    });
    
    console.log(`[ExcelService] ✅ Loaded ${dataMap.size} employees from Excel`);
    
    // Log first 5 employee numbers for debugging
    const firstFive = Array.from(dataMap.keys()).slice(0, 5);
    console.log(`[ExcelService] Sample employee numbers:`, firstFive);
    
    // Update cache
    salaryDataCache = dataMap;
    lastLoadTime = Date.now();
    
    return dataMap;
  } catch (err) {
    const error = err as Error;
    console.error('[ExcelService] Error loading Excel file:', error.message);
    throw new Error(`Failed to load salary data from Excel: ${error.message}`);
  }
}

/**
 * Get salary data for a specific employee
 */
export function getEmployeeSalary(employeeNo: string | number): EmployeeSalaryData | null {
  const dataMap = loadSalaryData();
  const empNo = String(employeeNo);
  
  console.log(`[ExcelService] Looking up employee: ${empNo}`);
  const result = dataMap.get(empNo);
  
  if (result) {
    console.log(`[ExcelService] ✅ Found employee ${empNo}: ${result.name}, Salary: ₹${result.fullBasic.toLocaleString('en-IN')}`);
  } else {
    console.log(`[ExcelService] ❌ Employee ${empNo} not found. Total employees in Excel: ${dataMap.size}`);
    // Log all employee numbers that contain this number
    const similar = Array.from(dataMap.keys()).filter(key => key.includes(empNo));
    if (similar.length > 0) {
      console.log(`[ExcelService] Similar employee numbers found:`, similar);
    }
  }
  
  return result || null;
}

/**
 * Get all employees from Excel
 */
export function getAllEmployees(): EmployeeSalaryData[] {
  const dataMap = loadSalaryData();
  return Array.from(dataMap.values());
}

/**
 * Search employees by name
 */
export function searchEmployeesByName(name: string): EmployeeSalaryData[] {
  const dataMap = loadSalaryData();
  const searchTerm = name.toLowerCase();
  
  return Array.from(dataMap.values()).filter(emp =>
    emp.name.toLowerCase().includes(searchTerm)
  );
}

/**
 * Get employees by department
 */
export function getEmployeesByDepartment(department: string): EmployeeSalaryData[] {
  const dataMap = loadSalaryData();
  
  return Array.from(dataMap.values()).filter(emp =>
    emp.department.toLowerCase() === department.toLowerCase()
  );
}

/**
 * Reload salary data (clear cache)
 */
export function reloadSalaryData(): Map<string, EmployeeSalaryData> {
  salaryDataCache = null;
  lastLoadTime = 0;
  return loadSalaryData();
}

export default {
  loadSalaryData,
  getEmployeeSalary,
  getAllEmployees,
  searchEmployeesByName,
  getEmployeesByDepartment,
  reloadSalaryData,
};

