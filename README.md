# Virtualized_Smart_Router

INSE 6170 – PROJECT PROPOSAL
IoT Security Gateway (Virtualized Smart Router)

1. Introduction
   This project is an IoT Security Gateway that acts as a software-based wireless router managing real IoT devices
   and enforcing network-level security policies. The gateway runs on a Linux virtual machine (Ubuntu/CentOS) and monitors
   real IoT devices connected to your network via WiFi, Ethernet, or USB. The system provides device discovery using ARP
   table scanning, network-level firewall enforcement with iptables, packet capture with tcpdump, and anomaly detection
   using iptables counters and traffic analysis. This approach enables full visibility and control over IoT device
   communications at the gateway level. As IoT devices continue to proliferate in homes and organizations, they remain
   common targets for large-scale attacks such as Mirai. This project focuses on improving monitoring and enforcement
   directly at the gateway level.
2. Platform & Technology Stack
   The system is implemented on a Linux virtual machine (Ubuntu 26.0+ or CentOS 9+) to ensure full control over networking
   behavior and security enforcement. The backend is developed in Python using FastAPI, which handles device discovery,
   firewall rule management, packet capture, and intrusion prevention logic. The frontend is built with React and serves
   as a web-based administrative dashboard for managing devices and viewing logs. At the networking layer, iptables
   enforces whitelist-based firewall policies, tcpdump handles per-device packet capture, and the system uses ARP scanning
   and /proc/net/dev parsing for device discovery and traffic monitoring. SQLite stores device metadata, traffic logs,
   and historical data records. Recharts visualizes historical traffic patterns and device activity. This technology stack
   provides a practical, realistic system while remaining manageable.
   Key Technologies
   Layer Technology Purpose
   Frontend React Web-based admin dashboard for device management and monitoring
   Backend Python + FastAPI REST API, device discovery, firewall control, packet capture, IPS logic
   Device Discovery ARP table scanning Detect real IoT devices on the network
   Packet Capture tcpdump Capture and save per-device pcap files
   Firewall iptables Whitelist-based traffic filtering and rule enforcement
   Traffic Monitoring iptables counters / /proc/net/dev Measure per-device data rate for anomaly detection
   Database SQLite Store device metadata, logs, firewall rules, traffic history
   Notifications Python smtplib Email alerts for abnormal behavior
   Visualization Recharts Display historical data rate graphs in dashboard
3. Preliminary Architecture Design
   The project follows a modular architecture:
   i. Real IoT Devices:
   Mobile phones, smart home devices, and other IoT equipment connected to the network via WiFi, Ethernet, or USB.
   The gateway discovers them automatically using ARP scanning and /proc/net/dev parsing.
   ii. Gateway Layer:
   Runs on the Linux VM. It performs device discovery, firewall filtering, traffic monitoring, and packet capture.
   iii. Backend API:
   Built with FastAPI. Exposes REST endpoints for device listing, rule configuration, packet capture control, and log access.
   iv. Web Dashboard:
   React-based interface used by the administrator to manage devices, configure policies, and view traffic logs.
   All components run within the VM environment, providing a centralized management point for real network devices.
4. Implementation Plan
   The five required functions will be implemented as follows:
   Device Discovery and Management:
   The backend will periodically scan the local network to detect connected IoT devices and retrieve their IPv4 and MAC
   addresses. This will be done by reading the system ARP table and DHCP lease information within the virtual network
   environment. Each detected device will be recorded along with its MAC address and vendor information obtained
   through a MAC OUI lookup. The administrator will be able to view the device list through the web dashboard and edit
   additional metadata such as device name, model, version, and description. All device information will be stored and
   managed in an SQLite database.
   Packet Capture:
   The administrator will be able to select one or more IoT devices from the dashboard and initiate packet capture for
   those devices. The backend will execute tcpdump filtered by the selected device IP address and save the captured
   traffic into separate .pcap files for each device. The admin can specify either a capture duration or a packet count. The
   dashboard will allow the administrator to start, stop, or terminate packet capture sessions, and the resulting files will
   be stored for later analysis.
   Whitelist Firewall:
   The system will provide a whitelist-based firewall that allows the administrator to define permitted communication
   flows for each IoT device. These rules will specify allowed destination IP addresses, ports, and protocols, and can be
   edited after creation. The backend will translate the configured rules into iptables commands applied at the gateway
   level. Any traffic that does not match the defined whitelist rules will be automatically dropped. Firewall rules will be
   saved in SQLite and automatically restored when the system starts. The dashboard also shows live per-device counters
   (RX/TX bytes and packets) collected from iptables for quick verification.
   Intrusion Prevention System (IPS):
   The gateway will continuously monitor network traffic generated by each IoT device. Traffic statistics will be collected
   at regular intervals using Linux networking counters and iptables byte counters per device. If a device exceeds its
   configured data rate threshold, the system will record the event and automatically capture packets for a short period to
   log the suspicious activity. The administrator will receive an email notification describing the anomaly, and the system
   will temporarily apply a restrictive firewall rule to limit the device’s network activity for a configurable number of
   minutes.
   Log and File Management:
   The web dashboard will allow the administrator to review system activity and traffic history. Historical data rate
   information for each device will be displayed using visual graphs for a configurable number of days. The interface will
   also provide a list of saved packet capture files generated by the packet capture function. The administrator will be able
   to view or delete these files and manage stored logs. Older records will be automatically removed after the configured
   retention period to prevent excessive storage usage.
5. Conclusion
   This project delivers a fully functional virtual IoT security gateway implemented entirely in a controlled Linux
   environment. By combining Linux networking tools with a modern web dashboard, the system provides
   device visibility, traffic control, anomaly detection, and log management. The virtualized approach ensures
   feasibility within the course timeline while maintaining realistic networking behavior and strong security
   relevance.
   ---git repository link: [Virtualized Smart Router](https://github.com/OladipoOmotosho/Virtualized_Smart_Router.git)

Project Timeline

Week 1
Linux VM setup and networking prerequisites

Week 2
Device discovery and database integration

Week 3
Packet capture implementation

Week 4
Whitelist firewall configuration

Week 5
IPS monitoring and logging

Week 6
React dashboard and visualization

Week 7
Testing, debugging, and documentation
