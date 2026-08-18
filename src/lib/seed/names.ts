const FIRST = [
  "Rahul",  "Shubham",  "Priya",  "Aarav",  "Sneha",  "Vikram",  "Ananya",  "Rohan",  "Ishita",  "Aditya",
  "Kavya",  "Nikhil",  "Pooja",  "Arjun",  "Divya",  "Siddharth",  "Neha",  "Karan",  "Tanvi",  "Varun",
  "Amit",  "Sunita",  "Rajesh",  "Pallavi",  "Sanjay",  "Deepa",  "Manoj",  "Sapna",  "Rakesh",  "Geeta",
  "Suresh",  "Aarti",  "Vijay",  "Meena",  "Manish",  "Rekha",  "Ashok",  "Usha",  "Ravi",  "Leela",
  "Sunil",  "Sudha",  "Mohan",  "Kamla",  "Anil",  "Indira",  "Ajay",  "Savitri",  "Rajiv",  "Saroj",
  "Naveen",  "Urmila",  "Prakash",  "Ashish",  "Padma",  "Vinod",  "Shanti",  "Sachin",  "Deepak",  "Madhu",
  "Alok",  "Meera",  "Raj",  "Kamini",  "Vivek",  "Shobha",  "Gaurav",  "Arti",  "Nitin",  "Suman",
  "Anjali",  "Atul",  "Seema",  "Pankaj",  "Savita",  "Kapil",  "Nandini",  "Jitender",  "Asha",  "Vikas",
  "Chhaya",  "Reena",  "Saurabh",  "Poonam",  "Rajeev",  "Alka",  "Ashwini",  "Kavita",  "Bharat",  "Surender",
  "Neelam",  "Jagdish",  "Monika",  "Praveen",  "Shikha",  "Kailash",  "Mamta",  "Harish",  "Veena",  "Naresh",
  "Neerja",  "Dinesh",  "Rachna",  "Pramod",  "Mandira",  "Anju",  "Priti",  "Richa",  "Dipti",  "Bharti",
  "Komal",  "Rina",  "Alisha",  "Ganga",  "Namrata",  "Mitali",  "Manju",  "Sonia",  "Anita",  "Madhuri",
  "Chandni",  "Yamini",  "Vandana",  "Parul",  "Nupur",  "Deepali",  "Rupali",  "Nehal",  "Payal",  "Swati",
  "Chitra",  "Lalita",  "Damini",  "Garima",  "Bhavana",  "Vimla",  "Geetika",  "Gauri",  "Bhumika",  "Amrita",
  "Farah",  "Saira",  "Zareena",  "Bushra",  "Rukhsana",  "Nazreen",  "Salma",  "Razia",  "Hina",  "Samina",
  "Hasina",  "Jasmin",  "Simran",  "Amrit",  "Harpreet",  "Gurpreet",  "Manpreet",  "Navneet",  "Jaspreet",  "Sukhpreet",
  "Tejpal",  "Balwinder",  "Ranjit",  "Harjinder",  "Manjinder",  "Sukhjinder",  "Dilbagh",  "Gurmail",  "Kulwinder",  "Satinder",
  "Jatinder",  "Sukhwant",  "Davinder",  "Balbir",  "Firoz",  "Imran",  "Irfan",  "Javed",  "Junaid",  "Kaleem",
  "Kamran",  "Karim",  "Khalid",  "Mansoor",  "Mazhar",  "Mubin",  "Nadeem",  "Nasir",  "Parvez",  "Qadir",
  "Rashid",  "Sadiq",  "Salim",  "Tariq",  "Wasim",  "Zubair",  "Faiz",  "Farhan",  "Farooq",  "Hamid",
  "Hassan",  "Husain",  "Ibrahim",  "Kasim",  "Nabil",  "Saeed",  "Tahir",  "Usman",  "Yusuf",  "Zafar",
  "Ahmed",  "Ismail",  "Mustafa",  "Cyrus",  "Darius",  "Rustom",  "Homi",  "Sohail",  "Aakash",  "Aadi",
  "Aarnav",  "Abhay",  "Abhimanyu",  "Abhishek",  "Adhiraj",  "Advaith",  "Agastya",  "Akshay",  "Akshat",  "Amar",
  "Amir",  "Aniket",  "Anirudh",  "Anish",  "Anoop",  "Aryan",  "Atharv",  "Avi",  "Aviral",  "Ayush",
  "Badrinath",  "Basav",  "Bhavik",  "Bhuvan",  "Chetan",  "Daksh",  "Darshan",  "Deven",  "Dhruv",  "Dilip",
  "Dushyant",  "Eknath",  "Ganesh",  "Girish",  "Gopal",  "Govind",  "Harendra",  "Hemant",  "Himanshu",  "Jairam",
  "Jaswant",  "Jatin",  "Jay",  "Jayant",  "Jitendra",  "Kabir",  "Kamal",  "Kamlesh",  "Keshav",  "Kishor",
  "Kishore",  "Krunal",  "Kundan",  "Lalit",  "Lokesh",  "Madhav",  "Mahesh",  "Manas",  "Mohit",  "Mukesh",
  "Narayan",  "Neeraj",  "Nilesh",  "Niraj",  "Nischal",  "Omkar",  "Onkar",  "Parth",  "Pavan",  "Prem",
  "Raghav",  "Rajat",  "Raman",  "Ramesh",  "Ranjan",  "Ratan",  "Rehan",  "Rishabh",  "Ritesh",  "Sagar",
];
const LAST = [
  "Sharma",  "Kambli",  "Patel",  "Kumar",  "Singh",  "Reddy",  "Gupta",  "Mehta",  "Iyer",  "Rao",
  "Joshi",  "Das",  "Naik",  "Deshmukh",  "Chauhan",  "Verma",  "Tiwari",  "Mishra",  "Pandey",  "Dubey",
  "Sinha",  "Nair",  "Menon",  "Pillai",  "Bhatt",  "Jain",  "Agarwal",  "Saxena",  "Bansal",  "Goel",
  "Malhotra",  "Kapoor",  "Chopra",  "Khanna",  "Sethi",  "Ahlawat",  "Gill",  "Sandhu",  "Brar",  "Dhillon",
  "Kaur",  "Dhawan",  "Tandon",  "Bhatia",  "Chadha",  "Kohli",  "Arora",  "Bajaj",  "Mehra",  "Wadhwa",
  "Rastogi",  "Srivastava",  "Shukla",  "Chaturvedi",  "Trivedi",  "Pandya",  "Desai",  "Vyas",  "Vora",  "Modi",
  "Shah",  "Patil",  "Bhosale",  "Jadhav",  "Pawar",  "Deshpande",  "Kulkarni",  "Kale",  "Dongre",  "Gawande",
  "Borkar",  "Prabhu",  "Sant",  "Costa",  "Souza",  "Fernandes",  "Rodrigues",  "Pereira",  "Sequeira",  "Vaz",
  "Gonsalves",  "Coelho",  "Mascarenhas",  "Lobo",  "Noronha",  "Carvalho",  "Pinto",  "Rebello",  "Monteiro",  "Saldanha",
  "Ferreira",  "Pinheiro",  "Barbosa",  "Araujo",  "Ribeiro",  "Lima",  "Ramos",  "Nunes",  "Teixeira",  "Cardoso",
  "Chatterjee",  "Banerjee",  "Ghosh",  "Bose",  "Roy",  "Mukherjee",  "Sen",  "Bhattacharyya",  "Dasgupta",  "Ganguly",
  "Bandyopadhyay",  "Sarkar",  "Lahiri",  "Majumdar",  "Basu",  "Hazra",  "Mitra",  "Pal",  "De",  "Jana",
  "Sengupta",  "Nag",  "Chakraborty",  "Khan",  "Ali",  "Syed",  "Sheikh",  "Siddiqui",  "Qureshi",  "Hussain",
  "Mirza",  "Baig",  "Usmani",  "Sherwani",  "Niazi",  "Mallick",  "Ansari",  "Raza",  "Nabi",  "Farooqui",
  "Fazal",  "Iqbal",  "Ahmad",  "Masood",  "Haidar",  "Jafari",  "Kazmi",  "Naqvi",  "Rizvi",  "Kidwai",
  "Azmi",  "Tirmizi",  "Hashmi",  "Butt",  "Bukhari",  "Cheema",  "Tarar",  "Gondal",  "Chaudhry",  "Khokhar",
  "Paracha",  "Shahzad",  "Godrej",  "Tata",  "Birla",  "Ambani",  "Mistry",  "Padamsee",  "Yadav",  "Naidu",
  "Goud",  "Iyengar",  "Krishnamurthy",  "Sundaram",  "Balasubramanian",  "Ramanujan",  "Venkatesh",  "Subramaniam",  "Rajagopal",  "Viswanathan",
  "Chandrasekaran",  "Srinivasan",  "Ramaswamy",  "Swaminathan",  "Parthasarathy",  "Narasimhan",  "Ganapathy",  "Rajaram",  "Ranganathan",  "Rajagopalan",
  "Seshadri",  "Padmanabhan",  "Anantharaman",  "Varadarajan",  "Sundararajan",  "Ramachandran",  "Balaji",  "Prakash",  "Sridhar",  "Gopalakrishnan",
  "Nambiar",  "Namboodiri",  "Warrier",  "Panicker",  "Thampi",  "Kurup",  "Kartha",  "Unnithan",  "Mathew",  "Chandy",
  "Oommen",  "Varghese",  "Thomas",  "Philip",  "Kurien",  "Jacob",  "Zacharia",  "Jose",  "Eapen",  "Koshy",
  "Markose",  "Chacko",  "Cheriyan",  "Thottathil",  "Agrawal",  "Ahuja",  "Bahl",  "Bakshi",  "Batra",  "Bhalla",
  "Chawla",  "Dhall",  "Dutta",  "Gaba",  "Gandhi",  "Goenka",  "Goyal",  "Gulati",  "Handa",  "Hans",
  "Juneja",  "Kalra",  "Kaura",  "Khurana",  "Kochhar",  "Luthra",  "Madaan",  "Mahajan",  "Manchanda",  "Mittal",
  "Nanda",  "Narang",  "Narula",  "Oswal",  "Rai",  "Sachdeva",  "Sahni",  "Saini",  "Saluja",  "Seth",
  "Singla",  "Sodhi",  "Soni",  "Suri",  "Taneja",  "Tuli",  "Tyagi",  "Uppal",  "Vermani",  "Vig",
  "Vohra",  "Walia",  "Grewal",  "Dhingra",  "Bali",  "Chhabra",  "Lodha",  "Dalal",  "Jhunjhunwala",  "Premji",
  "Murthy",  "Hegde",  "Kamat",  "Rane",  "Sawant",  "Bhat",  "Kamath",  "Shenoy",  "Kotian",  "Poojary",
  "Colaco",  "Gracias",  "Lopes",  "Rosario",  "Dias",  "Baptista",  "Trindade",  "Xavier",  "Coutinho",  "Menezes",
];

export const POOL_SIZE = FIRST.length * LAST.length;

export function seededNames(n: number): [string, string] {
  const scrambled = (n * 7919) % POOL_SIZE;
  const firstIdx = scrambled % FIRST.length;
  const lastIdx = Math.floor(scrambled / FIRST.length);
  return [FIRST[firstIdx], LAST[lastIdx]];
}

