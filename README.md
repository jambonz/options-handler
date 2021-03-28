# options-handler

This application handles SIP OPTIONs pings that are received by the SBC.  It responds 200 OK in all cases, and if the request was sent from a Feature server or RTP server it updates the list of such active servers in redis accordingly.