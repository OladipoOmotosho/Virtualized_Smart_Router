INSE 6170 Course Project Information
Project Description:
In this project, you are expected to develop a smartphone app or computer software
which acts as a wireless router for IoT devices. When you turn on the hotspot on the
phone or the computer, it should allow IoT devices to connect to the Internet through
the hotspot. The wireless router can detect all IoT devices connected through it. You
are expected to add the following functions to the wireless router:

1. Function 1: List all the connected IoT devices. The list should show the Ipv4,
   Ipv6, Mac address, vendor if they are available. You could find the vendor
   information based on their MAC address. You should allow the admin to edit
   the information of the devices. You can add information such as name, vendor,
   model, version, description etc., and save them. You can also edit the
   information you entered previously.
2. Function 2: Capture packets of IoT devices in a batch. You should allow the
   admin to capture the packets of selected IoT devices. You can select the
   devices on the list and specify how many packets to capture or for how long
   time to capture them. Save the captured packets into pcap files by one file for
   each device. You can specify the file names. You can pause or terminate the
   packet capture at any time.
3. Function 3: Add a simple white-list-based firewall to the smart router. The
   admin can configure a firewall table to allow dataflows as you wish. For
   example, you can allow dataflows between the IoT device and a cloud service
   with IP W.X.Y.Z on port 443. The firewall will execute the firewall table and
   drop packets that do not match the allow list.
4. Function 4: Build a simple IPS on your wireless router. If some IoT devices are
   behaving abnormally, for example, the current data rate is higher than the
   data rate specified for the device, automatically log the traffic for 10 seconds
   and notify the admin by emails or phone notifications. At the same time,
   throttle the data rate to the minimum data rate specified for the device for n
   minutes to allow the admin to react, where n is configurable.
5. Function 5: Check and manage the logs. Admin is allowed to check the data
   rate history of any IoT device for the last m days, where m is configurable. A
   visual graph of historical data rate is strongly recommended for your UI design
   score. The admin is also allowed to see this list of all pcap files captured in part
6. In addition, the admin is allowed to delete partial or all saved files or pcap
   records. Outdated historical records should be deleted automatically.
   The project demo will be evaluated by its UI design, functionality, correctness, and
   ease of use. You should work individually on this project. You are expected to provideyour own devices and tools for the project. You are asked to create a Github project
   with history tracking and commit your code there.
   A project proposal (must be done individually) is due on March 8th. A final
   presentation or demo will be scheduled for April 23rd(tentative). The final project
   report will be due on April 30th(tentative). If you have questions, please do not
   hesitate the contact Dr. Fung.
   Project Proposal Guidelines:
   You are expected to write a 1-2 page project proposal for either the default project
   or the project of your own choice if you are a thesis-based student.
   If you are working on the default course project, you should provide a plan on how
   to implement the app/software. For example, you can specify your preference of
   platform (app or software), whether you plan to start from scratch, or work on top
   of another project. A preliminary design of the app/software architecture design
   would be great. Each person writes their own proposal. You should create a Github
   project and share the project link with Dr. Fung. Her github account is
   associated with her Concordia email (<carol.fung@concordia.ca>). Make sure she is
   allowed to access your Github project.
   If you choose to work on your own project, which should be related to your thesis,
   the project proposal should contain background, the related work, the proposed
   methodology, and the timeline. Note that you cannot use the project you already
   published or mostly finished. You can either create a new project or expand an
   existing project.
   Project Report Guidelines:
   Your final project report submission should contain the following files: the project
   report in pdf format, the necessary source-code files (.java, .c, .py etc.), any other
   relevant files including the source files of the report, data files, and instructions to
   run the code.
   If you choose the default project, your report should contain background information,
   motivation, the related work, the architecture design, how the project is
   implemented, the UI design and functions, conclusion, and references. If you choose
   to work on your own project, the report should contain introduction, related work,
   problem description, solution, experimental evaluation, discussion and conclusion.Project Report should be written in Overleaf (Online LaTeX Editor) and the pdf should
   be the results of a compiled latex source files. The style of the project report should
   be the IEEE conference style (double column). The number of pages for the project
   report should be 6-8 pages for individual projects.
   Important Notes\*:
   Plagiarism is also strictly bidden. You
   must cite your work properly. A violation could lead to a failed grade on this course.
   If you have questions, do not hesitate to contact Dr. Fung
   <carol.fung@concordia.ca>.

INSE 6170 Course Project Presentation Schedule

Please claim a spot for your INSE 6170 project presentation. The final presentation will take place on April 23rd. The presentations will take place in my office EV 3.107.

You are expected to prepare a 25-minute presentation, including a presentation with slides (10 minutes) and a demo (15 minutes) if you are taking the default project. If you are doing your thesis project and no demo, you can do a presentation only. The available time slots are as below. Please fill the spot with your team members’ names. It is first come first serve.
