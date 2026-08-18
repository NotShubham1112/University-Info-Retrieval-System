const FIRST = [
  "Rahul",
  "Shubham",
  "Priya",
  "Aarav",
  "Sneha",
  "Vikram",
  "Ananya",
  "Rohan",
  "Ishita",
  "Aditya",
  "Kavya",
  "Nikhil",
  "Pooja",
  "Arjun",
  "Divya",
];
const LAST = [
  "Sharma",
  "Kambli",
  "Patel",
  "Kumar",
  "Singh",
  "Reddy",
  "Gupta",
  "Mehta",
  "Iyer",
  "Rao",
  "Joshi",
  "Das",
  "Naik",
  "Deshmukh",
  "Chauhan",
];

export function seededNames(n: number): [string, string] {
  return [FIRST[n % FIRST.length], LAST[Math.floor(n / FIRST.length) % LAST.length]];
}
