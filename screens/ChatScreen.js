"use client"

import { useState, useRef, useEffect } from "react"
import {
  View,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
  Animated,
  Alert,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import tw from "twrnc"
import { Feather } from "@expo/vector-icons"
import CustomText from "../components/CustomText"
import { auth, db } from "../firebaseConfig"
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  getDoc,
  addDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore"

const ChatScreen = () => {
  const navigation = useNavigation()
  const [chats, setChats] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filteredChats, setFilteredChats] = useState([])
  const [activeTab, setActiveTab] = useState("all") // all, search, claim

  // New state for the integrated chat conversation view
  const [selectedChat, setSelectedChat] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState("")
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [petInfo, setPetInfo] = useState(null)

  const scrollViewRef = useRef()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start()

    // Set up listeners for chats and search parties
    const unsubscribeChats = fetchChats()
    const unsubscribeSearchParties = fetchSearchParties()

    // Fetch message request notifications
    fetchMessageRequestNotifications()

    return () => {
      // Clean up listeners when component unmounts
      if (unsubscribeChats) unsubscribeChats()
      if (unsubscribeSearchParties) unsubscribeSearchParties()
    }
  }, [])

  useEffect(() => {
    filterChats()
  }, [chats, searchQuery, activeTab])

  // New effect to fetch messages when a chat is selected
  useEffect(() => {
    let unsubscribe = null

    if (selectedChat) {
      unsubscribe = fetchMessages(selectedChat)

      // Fetch pet info if petId exists
      if (selectedChat.pet?.id) {
        fetchPetInfo(selectedChat.pet.id)
      }
    }

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [selectedChat])

  const fetchChats = () => {
    if (!auth.currentUser) {
      setLoading(false)
      return null
    }

    try {
      // Query chats where the current user is a participant
      const chatsRef = collection(db, "chats")
      const q = query(
        chatsRef,
        where("participants", "array-contains", auth.currentUser.uid),
        orderBy("lastMessageTime", "desc"),
      )

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const chatData = snapshot.docs.map(async (chatDoc) => {
          const data = chatDoc.data()

          // Get pet information if petId exists
          let petInfo = null
          if (data.petId) {
            try {
              const petDocRef = doc(db, "petReports", data.petId)
              const petDoc = await getDoc(petDocRef)
              if (petDoc.exists()) {
                const petData = petDoc.data()
                petInfo = {
                  id: data.petId,
                  petName: petData.petName || "Unknown Pet",
                  petType: petData.petType || "Unknown",
                  image: petData.imageUrls && petData.imageUrls.length > 0 ? { uri: petData.imageUrls[0] } : null,
                }
              }
            } catch (error) {
              console.error("Error fetching pet info:", error)
            }
          }

          // Format timestamp
          let formattedTime = "Unknown"
          if (data.lastMessageTime) {
            const now = new Date()
            const messageTime = new Date(data.lastMessageTime.toDate())
            const diffInHours = Math.floor((now - messageTime) / (1000 * 60 * 60))

            if (diffInHours < 1) {
              formattedTime = "Just now"
            } else if (diffInHours < 24) {
              formattedTime = `${diffInHours}h ago`
            } else {
              formattedTime = messageTime.toLocaleDateString()
            }
          }

          return {
            id: chatDoc.id,
            name: data.name || "Chat",
            lastMessage: data.lastMessage || "No messages yet",
            timestamp: formattedTime,
            unreadCount: data.unreadCount?.[auth.currentUser.uid] || 0,
            type: data.type || "general",
            pet: petInfo,
          }
        })

        // Resolve all promises
        Promise.all(chatData).then((resolvedChats) => {
          setChats((prevChats) => {
            // Combine with existing search parties
            const existingSearchParties = prevChats.filter((chat) => chat.isSearchParty)
            return [...resolvedChats, ...existingSearchParties]
          })
          setLoading(false)
        })
      })

      return unsubscribe
    } catch (error) {
      console.error("Error fetching chats:", error)
      setLoading(false)
      return null
    }
  }

  const fetchSearchParties = () => {
    if (!auth.currentUser) {
      return null
    }

    try {
      const partiesRef = collection(db, "searchParties")
      const q = query(partiesRef, orderBy("createdAt", "desc"))

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const parties = snapshot.docs
          .map((doc) => {
            const data = doc.data()

            // Check if user is a participant or if the party is public
            const isParticipant =
              data.participants && Array.isArray(data.participants) && data.participants.includes(auth.currentUser.uid)

            const isPublic = data.isPublic === true

            // Only include if user is participant or party is public
            if (isParticipant || isPublic) {
              // Format timestamp
              let formattedTime = "Unknown"
              if (data.createdAt) {
                const now = new Date()
                const partyTime = new Date(data.createdAt.toDate())
                const diffInHours = Math.floor((now - partyTime) / (1000 * 60 * 60))

                if (diffInHours < 1) {
                  formattedTime = "Just now"
                } else if (diffInHours < 24) {
                  formattedTime = `${diffInHours}h ago`
                } else {
                  formattedTime = partyTime.toLocaleDateString()
                }
              }

              return {
                id: `search_party_${doc.id}`, // <-- Ensure uniqueness
                name: data.name || "Search Party",
                lastMessage: data.description || "Join the search party",
                timestamp: formattedTime,
                unreadCount: 0,
                type: "search",
                isSearchParty: true,
                pet: data.pet
                  ? {
                      id: data.pet.id,
                      petName: data.pet.petName || "Unknown Pet",
                      petType: data.pet.petType || "Unknown",
                      image:
                        data.pet.imageUrls && data.pet.imageUrls.length > 0 ? { uri: data.pet.imageUrls[0] } : null,
                    }
                  : null,
              }
            }
            return null
          })
          .filter(Boolean) // Remove null entries

        setChats((prevChats) => {
          // Keep existing regular chats
          const existingChats = prevChats.filter((chat) => !chat.isSearchParty)
          return [...existingChats, ...parties]
        })
        setLoading(false)
      })

      return unsubscribe
    } catch (error) {
      console.error("Error fetching search parties:", error)
      return null
    }
  }

  const fetchMessageRequestNotifications = async () => {
    if (!auth.currentUser) return

    try {
      // First, check for pets where the current user is the owner
      const ownedPetsQuery = query(collection(db, "petReports"), where("userId", "==", auth.currentUser.uid))

      const ownedPetsSnapshot = await getDocs(ownedPetsQuery)

      // Count total pending requests across all owned pets
      let totalPendingRequests = 0

      for (const petDoc of ownedPetsSnapshot.docs) {
        const pendingRequestsQuery = query(
          collection(db, "petReports", petDoc.id, "messageRequests"),
          where("status", "==", "pending"),
        )

        const pendingRequestsSnapshot = await getDocs(pendingRequestsQuery)
        totalPendingRequests += pendingRequestsSnapshot.size
      }

      // If there are pending requests, create a special notification item
      if (totalPendingRequests > 0) {
        // Add a notification to the navigation header
        navigation.setParams({
          pendingRequestsCount: totalPendingRequests,
        })

        // You could also add a special item to the chat list
        setChats((prevChats) => {
          // Remove any existing pending requests notification
          const filteredChats = prevChats.filter((chat) => chat.type !== "pending_requests")

          return [
            {
              id: "pending_requests",
              name: "Message Requests",
              lastMessage: `You have ${totalPendingRequests} pending message request${
                totalPendingRequests > 1 ? "s" : ""
              }`,
              timestamp: "New",
              unreadCount: totalPendingRequests,
              type: "pending_requests",
              isPendingRequests: true,
            },
            ...filteredChats,
          ]
        })
      }

      // Now check for approved requests where the current user is the requester
      const approvedRequests = []

      const petsSnapshot = await getDocs(collection(db, "petReports"))

      for (const petDoc of petsSnapshot.docs) {
        const requestsQuery = query(
          collection(db, "petReports", petDoc.id, "messageRequests"),
          where("userId", "==", auth.currentUser.uid),
          where("status", "==", "approved"),
        )

        const requestsSnapshot = await getDocs(requestsQuery)

        if (!requestsSnapshot.empty) {
          // Get pet details
          const petData = petDoc.data()

          requestsSnapshot.docs.forEach((reqDoc) => {
            approvedRequests.push({
              id: `approved_request_${reqDoc.id}`,
              name: `Chat with ${petData.contactName || "Pet Owner"}`,
              lastMessage: "You can now message about this pet",
              timestamp: "New",
              unreadCount: 1,
              type: "approved_request",
              pet: {
                id: petDoc.id,
                petName: petData.petName || "Unknown Pet",
                petType: petData.petType || "Unknown",
                image: petData.imageUrls && petData.imageUrls.length > 0 ? { uri: petData.imageUrls[0] } : null,
              },
              petReportId: petDoc.id,
              requestId: reqDoc.id,
            })
          })
        }
      }

      if (approvedRequests.length > 0) {
        setChats((prevChats) => {
          // Filter out any existing approved requests
          const filteredChats = prevChats.filter((chat) => chat.type !== "approved_request")
          return [...filteredChats, ...approvedRequests]
        })
      }
    } catch (error) {
      console.error("Error fetching message request notifications:", error)
    }
  }

  const filterChats = () => {
    let filtered = [...chats]

    // Filter by tab
    if (activeTab === "search") {
      filtered = filtered.filter(
        (chat) =>
          chat.type === "search" ||
          chat.name.toLowerCase().includes("search") ||
          chat.name.toLowerCase().includes("rescue"),
      )
    } else if (activeTab === "claim") {
      filtered = filtered.filter((chat) => chat.type === "claim" || chat.name.toLowerCase().includes("claim"))
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (chat) =>
          chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (chat.pet && chat.pet.petName && chat.pet.petName.toLowerCase().includes(searchQuery.toLowerCase())),
      )
    }

    setFilteredChats(filtered)
  }

  // New function to fetch pet info
  const fetchPetInfo = async (petId) => {
    try {
      const petDocRef = doc(db, "petReports", petId)
      const petDoc = await getDoc(petDocRef)

      if (petDoc.exists()) {
        const petData = petDoc.data()
        setPetInfo({
          id: petId,
          petName: petData.petName || "Unknown Pet",
          petType: petData.petType || "Unknown",
          status: petData.status || "unknown",
          imageUrl: petData.imageUrls && petData.imageUrls.length > 0 ? petData.imageUrls[0] : null,
        })
      }
    } catch (error) {
      console.error("Error fetching pet info:", error)
    }
  }

  // New function to fetch messages for a selected chat
  const fetchMessages = (chat) => {
    if (!chat || !chat.id) return

    setLoadingMessages(true)

    try {
      // Determine the collection path based on whether it's a search party or regular chat
      const collectionPath = chat.isSearchParty
        ? `searchParties/${chat.id.replace("search_party_", "")}/messages`
        : `chats/${chat.id}/messages`

      const messagesQuery = query(collection(db, collectionPath), orderBy("createdAt", "asc"))

      const unsubscribe = onSnapshot(messagesQuery, async (snapshot) => {
        // Create an array to store promises for fetching user data
        const messagePromises = snapshot.docs.map(async (messageDoc) => {
          const data = messageDoc.data()

          // Skip fetching user data for system messages
          if (data.isSystem) {
            return {
              id: messageDoc.id,
              text: data.text,
              sender: data.sender,
              senderName: "System",
              senderAvatar: null,
              createdAt: data.createdAt?.toDate() || new Date(),
              isCurrentUser: false,
              isSystem: true,
            }
          }

          // Fetch user data for the sender
          let senderName = data.senderName || "Unknown"
          let senderAvatar = null

          if (data.sender && data.sender !== "system") {
            try {
              // Correctly use the doc function from Firestore
              const userDocRef = doc(db, "users", data.sender)
              const userDocSnap = await getDoc(userDocRef)

              if (userDocSnap.exists()) {
                const userData = userDocSnap.data()
                senderName = userData.fullName || senderName
                senderAvatar = userData.photoURL || null
              }
            } catch (error) {
              console.error("Error fetching user data:", error)
            }
          }

          return {
            id: messageDoc.id,
            text: data.text,
            sender: data.sender,
            senderName: senderName,
            senderAvatar: senderAvatar,
            createdAt: data.createdAt?.toDate() || new Date(),
            isCurrentUser: data.sender === auth.currentUser?.uid,
            isSystem: data.isSystem || false,
          }
        })

        // Wait for all user data to be fetched
        const messageData = await Promise.all(messagePromises)

        setMessages(messageData)
        setLoadingMessages(false)

        // Scroll to bottom on new messages
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true })
        }, 100)
      })

      return unsubscribe
    } catch (error) {
      console.error("Error fetching messages:", error)
      setLoadingMessages(false)
      return null
    }
  }

  // New function to send a message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !auth.currentUser || !selectedChat) return

    try {
      const messageData = {
        text: newMessage.trim(),
        sender: auth.currentUser.uid,
        senderName: auth.currentUser.displayName || "User",
        createdAt: serverTimestamp(),
      }

      // Determine the collection path based on whether it's a search party or regular chat
      const chatId = selectedChat.isSearchParty ? selectedChat.id.replace("search_party_", "") : selectedChat.id

      const collectionPath = selectedChat.isSearchParty
        ? `searchParties/${chatId}/messages`
        : `chats/${chatId}/messages`

      // Add message to the appropriate collection
      await addDoc(collection(db, collectionPath), messageData)

      // Update the last message in the chat document
      const chatDocRef = doc(db, selectedChat.isSearchParty ? "searchParties" : "chats", chatId)
      await updateDoc(chatDocRef, {
        lastMessage: newMessage.trim(),
        lastMessageTime: serverTimestamp(),
      })

      // Clear the input
      setNewMessage("")
    } catch (error) {
      console.error("Error sending message:", error)
    }
  }

  const handleChatPress = (chat) => {
    console.log("Chat pressed:", chat.id, chat.type)

    if (chat.type === "pending_requests") {
      // Navigate to a screen that shows all pending requests
      navigation.navigate("PendingRequests")
    } else if (chat.type === "approved_request") {
      // Navigate to pet details screen with chat modal open
      navigation.navigate("PetDetails", {
        pet: { id: chat.petReportId },
        openChatModal: true,
      })
    } else {
      // Instead of navigating, set the selected chat
      setSelectedChat(chat)
    }
  }

  const createNewChat = async () => {
    if (!auth.currentUser) {
      Alert.alert("Authentication Required", "Please sign in to create a chat")
      return
    }

    try {
      const newChat = {
        name: "New Chat",
        participants: [auth.currentUser.uid],
        createdAt: serverTimestamp(),
        lastMessageTime: serverTimestamp(),
        lastMessage: "Chat created",
        type: "general",
      }

      const docRef = await addDoc(collection(db, "chats"), newChat)

      // Instead of navigating, set the selected chat
      setSelectedChat({
        id: docRef.id,
        name: "New Chat",
        lastMessage: "Chat created",
        timestamp: "Just now",
        type: "general",
      })
    } catch (error) {
      console.error("Error creating chat:", error)
      Alert.alert("Error", "Failed to create chat. Please try again.")
    }
  }

  const renderChatItem = ({ item }) => {
    return (
      <TouchableOpacity style={tw`flex-row p-4 border-b border-gray-100`} onPress={() => handleChatPress(item)}>
        {/* Chat or Pet Image */}
        {item.type === "pending_requests" ? (
          <View style={tw`w-14 h-14 rounded-lg bg-red-100 items-center justify-center`}>
            <Feather name="inbox" size={20} color="#EF4444" />
            <View
              style={tw`absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full items-center justify-center border-2 border-white`}
            >
              <CustomText style={tw`text-white text-[10px]`} weight="Bold">
                {item.unreadCount}
              </CustomText>
            </View>
          </View>
        ) : item.type === "approved_request" ? (
          <View style={tw`w-14 h-14 rounded-lg bg-green-100 items-center justify-center`}>
            <Feather name="message-circle" size={20} color="#10B981" />
            <View
              style={tw`absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full items-center justify-center border border-white`}
            >
              <CustomText style={tw`text-white text-[10px]`} weight="Bold">
                !
              </CustomText>
            </View>
          </View>
        ) : item.pet && item.pet.image ? (
          <View style={tw`relative`}>
            <Image source={item.pet.image} style={tw`w-14 h-14 rounded-lg bg-gray-200`} />
            {item.type === "search" && (
              <View
                style={tw`absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full items-center justify-center border border-white`}
              >
                <Feather name="search" size={10} color="white" />
              </View>
            )}
            {item.type === "claim" && (
              <View
                style={tw`absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full items-center justify-center border border-white`}
              >
                <Feather name="check" size={10} color="white" />
              </View>
            )}
          </View>
        ) : (
          <View style={tw`w-14 h-14 rounded-lg bg-blue-100 items-center justify-center`}>
            {item.type === "search" ? (
              <Feather name="search" size={20} color="#3B82F6" />
            ) : item.type === "claim" ? (
              <Feather name="check-circle" size={20} color="#10B981" />
            ) : (
              <Feather name="message-circle" size={20} color="#3B82F6" />
            )}
          </View>
        )}

        {/* Chat Info */}
        <View style={tw`flex-1 ml-3`}>
          <View style={tw`flex-row items-center justify-between`}>
            <View style={tw`flex-row items-center flex-1 mr-2`}>
              <CustomText style={tw`text-[16px] text-gray-800 mr-2`} weight="SemiBold" numberOfLines={1}>
                {item.name}
              </CustomText>
              {item.type === "search" && (
                <View style={tw`px-2 py-0.5 rounded-full bg-red-100`}>
                  <CustomText style={tw`text-[10px] text-red-700`} weight="Medium">
                    SEARCH
                  </CustomText>
                </View>
              )}
              {item.type === "claim" && (
                <View style={tw`px-2 py-0.5 rounded-full bg-green-100`}>
                  <CustomText style={tw`text-[10px] text-green-700`} weight="Medium">
                    CLAIM
                  </CustomText>
                </View>
              )}
              {item.type === "approved_request" && (
                <View style={tw`px-2 py-0.5 rounded-full bg-green-100 ml-2`}>
                  <CustomText style={tw`text-[10px] text-green-700`} weight="Medium">
                    NEW
                  </CustomText>
                </View>
              )}
              {item.type === "pending_requests" && (
                <View style={tw`px-2 py-0.5 rounded-full bg-red-100 ml-2`}>
                  <CustomText style={tw`text-[10px] text-red-700`} weight="Medium">
                    PENDING
                  </CustomText>
                </View>
              )}
            </View>
            <CustomText style={tw`text-[12px] text-gray-500`}>{item.timestamp}</CustomText>
          </View>

          {item.pet && (
            <CustomText style={tw`text-[13px] text-blue-600 mb-1`} weight="Medium">
              {item.pet.petName || item.pet.petType || "Unknown Pet"}
            </CustomText>
          )}

          <View style={tw`flex-row items-center justify-between`}>
            <CustomText style={tw`text-[14px] text-gray-600 flex-1`} numberOfLines={1}>
              {item.lastMessage}
            </CustomText>
            {item.unreadCount > 0 && (
              <View style={tw`bg-blue-500 rounded-full min-w-[20px] h-5 items-center justify-center px-1`}>
                <CustomText style={tw`text-[10px] text-white`} weight="Bold">
                  {item.unreadCount}
                </CustomText>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  const renderEmptyList = () => {
    if (loading) return null

    return (
      <View style={tw`flex-1 items-center justify-center py-20`}>
        <Feather name="message-circle" size={48} color="#D1D5DB" />
        <CustomText style={tw`text-gray-400 mt-4 text-center px-6`}>
          {searchQuery
            ? "No chats match your search"
            : activeTab === "search"
              ? "No search party chats found"
              : activeTab === "claim"
                ? "No pet claim chats found"
                : "No chats yet. Join a search party or claim a pet to start chatting!"}
        </CustomText>
      </View>
    )
  }

  // Format time for messages
  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  // Render a message in the conversation view
  const renderMessageItem = (message) => {
    return (
      <View
        key={message.id}
        style={tw`mb-3 ${message.isCurrentUser ? "items-end" : "items-start"} ${message.isSystem ? "items-center" : ""}`}
      >
        {message.isSystem ? (
          <View style={tw`bg-gray-100 px-4 py-2 rounded-full my-2`}>
            <CustomText style={tw`text-[12px] text-gray-600`}>{message.text}</CustomText>
          </View>
        ) : (
          <>
            {!message.isCurrentUser && (
              <View style={tw`flex-row items-center mb-1`}>
                {message.senderAvatar ? (
                  <Image source={{ uri: message.senderAvatar }} style={tw`w-6 h-6 rounded-full mr-2`} />
                ) : (
                  <View style={tw`w-6 h-6 rounded-full bg-gray-200 items-center justify-center mr-2`}>
                    <Feather name="user" size={12} color="#6B7280" />
                  </View>
                )}
                <CustomText style={tw`text-[12px] text-gray-500`} weight="Medium">
                  {message.senderName}
                </CustomText>
              </View>
            )}
            <View style={tw`max-w-[80%] p-3 rounded-2xl ${message.isCurrentUser ? "bg-blue-500" : "bg-gray-200"}`}>
              <CustomText style={tw`${message.isCurrentUser ? "text-white" : "text-gray-800"}`}>
                {message.text}
              </CustomText>
            </View>
            <CustomText
              style={tw`text-[10px] text-gray-500 mt-1 ${message.isCurrentUser ? "text-right" : "text-left"}`}
            >
              {formatTime(message.createdAt)}
            </CustomText>
          </>
        )}
      </View>
    )
  }

  // Render the chat list view
  const renderChatListView = () => {
    return (
      <>
        {/* Header */}
        <View style={tw`pt-12 px-6 pb-4 bg-white shadow-sm z-10`}>
          <View style={tw`flex-row items-center justify-between`}>
            <CustomText style={tw`text-[22px] text-gray-800`} weight="Bold">
              Messages
            </CustomText>
            <TouchableOpacity onPress={() => navigation.navigate("Notifications")}>
              <Feather name="bell" size={22} color="#3B82F6" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <View style={tw`px-6 py-3`}>
          <View style={tw`flex-row items-center bg-gray-100 rounded-xl px-4 py-2`}>
            <Feather name="search" size={18} color="#9CA3AF" style={tw`mr-2`} />
            <TextInput
              style={tw`flex-1 text-gray-800`}
              placeholder="Search chats..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Feather name="x" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={tw`flex-row border-b border-gray-200 mb-2`}>
          <TouchableOpacity
            style={tw`flex-1 py-3 items-center ${activeTab === "all" ? "border-b-2 border-blue-500" : ""}`}
            onPress={() => setActiveTab("all")}
          >
            <CustomText
              style={tw`text-[14px] ${activeTab === "all" ? "text-blue-600" : "text-gray-600"}`}
              weight={activeTab === "all" ? "SemiBold" : "Medium"}
            >
              All Chats
            </CustomText>
          </TouchableOpacity>
          <TouchableOpacity
            style={tw`flex-1 py-3 items-center ${activeTab === "search" ? "border-b-2 border-blue-500" : ""}`}
            onPress={() => setActiveTab("search")}
          >
            <CustomText
              style={tw`text-[14px] ${activeTab === "search" ? "text-blue-600" : "text-gray-600"}`}
              weight={activeTab === "search" ? "SemiBold" : "Medium"}
            >
              Search Parties
            </CustomText>
          </TouchableOpacity>
          <TouchableOpacity
            style={tw`flex-1 py-3 items-center ${activeTab === "claim" ? "border-b-2 border-blue-500" : ""}`}
            onPress={() => setActiveTab("claim")}
          >
            <CustomText
              style={tw`text-[14px] ${activeTab === "claim" ? "text-blue-600" : "text-gray-600"}`}
              weight={activeTab === "claim" ? "SemiBold" : "Medium"}
            >
              Pet Claims
            </CustomText>
          </TouchableOpacity>
        </View>

        {/* Chat List */}
        {loading ? (
          <View style={tw`flex-1 items-center justify-center`}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <CustomText style={tw`text-gray-500 mt-4`}>Loading chats...</CustomText>
          </View>
        ) : (
          <Animated.View
            style={[
              tw`flex-1`,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <FlatList
              data={filteredChats}
              renderItem={renderChatItem}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={renderEmptyList}
              contentContainerStyle={tw`${filteredChats.length === 0 ? "flex-1" : ""}`}
            />
          </Animated.View>
        )}

        {/* No User Logged In */}
        {!auth.currentUser && !loading && (
          <View style={tw`flex-1 items-center justify-center p-6`}>
            <Feather name="user-x" size={48} color="#D1D5DB" />
            <CustomText style={tw`text-[18px] text-gray-700 mt-4 text-center`} weight="Medium">
              Sign in to view your chats
            </CustomText>
            <CustomText style={tw`text-gray-500 mt-2 mb-6 text-center`}>
              You need to be signed in to view and participate in chats
            </CustomText>
            <TouchableOpacity style={tw`bg-blue-500 py-3 px-6 rounded-xl`} onPress={() => navigation.navigate("Login")}>
              <CustomText style={tw`text-white text-[16px]`} weight="SemiBold">
                Sign In
              </CustomText>
            </TouchableOpacity>
          </View>
        )}
      </>
    )
  }

  // Render the conversation view
  const renderConversationView = () => {
    return (
      <KeyboardAvoidingView
        style={tw`flex-1 bg-white`}
        behavior={Platform.OS === "ios" ? "padding" : null}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* Header */}
        <View style={tw`pt-12 px-6 pb-4 flex-row items-center justify-between bg-white shadow-sm`}>
          <TouchableOpacity style={tw`mr-4`} onPress={() => setSelectedChat(null)}>
            <Feather name="arrow-left" size={24} color="#3B82F6" />
          </TouchableOpacity>
          <View style={tw`flex-1`}>
            <CustomText style={tw`text-[18px] text-gray-800`} weight="Bold">
              {selectedChat?.name || "Chat"}
            </CustomText>
            {petInfo && (
              <CustomText style={tw`text-[12px] text-gray-500`}>
                About: {petInfo.petName} ({petInfo.petType})
              </CustomText>
            )}
          </View>
          {petInfo && petInfo.imageUrl ? (
            <Image source={{ uri: petInfo.imageUrl }} style={tw`w-10 h-10 rounded-full bg-gray-200`} />
          ) : (
            <View style={tw`w-10 h-10 rounded-full bg-gray-200 items-center justify-center`}>
              <Feather name="user" size={20} color="#6B7280" />
            </View>
          )}
        </View>

        {/* Pet Info Banner (if applicable) */}
        {petInfo && (
          <TouchableOpacity
            style={tw`mx-4 my-2 p-3 bg-blue-50 rounded-xl flex-row items-center border border-blue-100`}
            onPress={async () => {
              try {
                // Fetch the complete pet data before navigating
                const petDocRef = doc(db, "petReports", petInfo.id)
                const petDoc = await getDoc(petDocRef)

                if (petDoc.exists()) {
                  // Navigate with the full pet object
                  navigation.navigate("PetDetails", {
                    pet: {
                      id: petInfo.id,
                      ...petDoc.data(),
                    },
                  })
                } else {
                  Alert.alert("Error", "Pet information not found")
                }
              } catch (error) {
                console.error("Error fetching pet details:", error)
                Alert.alert("Error", "Failed to load pet details")
              }
            }}
          >
            {petInfo.imageUrl ? (
              <Image source={{ uri: petInfo.imageUrl }} style={tw`w-10 h-10 rounded-lg mr-3`} />
            ) : (
              <View style={tw`w-10 h-10 rounded-lg bg-blue-100 items-center justify-center mr-3`}>
                <Feather name="image" size={20} color="#3B82F6" />
              </View>
            )}
            <View style={tw`flex-1`}>
              <CustomText style={tw`text-[14px] text-blue-700`} weight="Medium">
                {petInfo.petName} - {petInfo.status.toUpperCase()}
              </CustomText>
              <CustomText style={tw`text-[12px] text-blue-600`}>Tap to view pet details</CustomText>
            </View>
            <Feather name="chevron-right" size={20} color="#3B82F6" />
          </TouchableOpacity>
        )}

        {/* Messages */}
        {loadingMessages ? (
          <View style={tw`flex-1 items-center justify-center`}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <CustomText style={tw`text-gray-500 mt-4`}>Loading messages...</CustomText>
          </View>
        ) : (
          <ScrollView
            ref={scrollViewRef}
            style={tw`flex-1 px-4`}
            contentContainerStyle={tw`pt-4 pb-4`}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
          >
            {messages.length === 0 ? (
              <View style={tw`items-center justify-center py-10`}>
                <View style={tw`w-16 h-16 rounded-full bg-blue-100 items-center justify-center mb-4`}>
                  <Feather name="message-circle" size={32} color="#3B82F6" />
                </View>
                <CustomText style={tw`text-[16px] text-gray-700 mb-2 text-center`} weight="Medium">
                  No messages yet
                </CustomText>
                <CustomText style={tw`text-[14px] text-gray-500 text-center px-10`}>
                  Start the conversation about {petInfo?.petName || "this pet"}
                </CustomText>
              </View>
            ) : (
              messages.map(renderMessageItem)
            )}
          </ScrollView>
        )}

        {/* Message Input */}
        <View style={tw`px-4 py-3 border-t border-gray-200 bg-white`}>
          <View style={tw`flex-row items-center`}>
            <View style={tw`flex-1 bg-gray-100 rounded-full px-4 py-2 mr-2 flex-row items-center`}>
              <TextInput
                style={tw`flex-1 text-gray-800`}
                placeholder="Type a message..."
                value={newMessage}
                onChangeText={setNewMessage}
                multiline
              />
              <TouchableOpacity>
                <Feather name="camera" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={tw`w-10 h-10 rounded-full ${newMessage.trim() ? "bg-blue-500" : "bg-gray-300"} items-center justify-center`}
              onPress={handleSendMessage}
              disabled={!newMessage.trim()}
            >
              <Feather name="send" size={18} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    )
  }

  return <View style={tw`flex-1 bg-white`}>{selectedChat ? renderConversationView() : renderChatListView()}</View>
}

export default ChatScreen
