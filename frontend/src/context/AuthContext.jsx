import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { post, get, put } from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  const fetchUser = useCallback(async () => {
    if (!token) {
      setLoading(false)
      return
    }
    try {
      const data = await get('/auth/me')
      setUser(data.user || data)
    } catch (err) {
      console.error('Failed to fetch user:', err)
      localStorage.removeItem('token')
      setToken(null)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  const login = async (email, password) => {
    const data = await post('/auth/login', { email, password })
    const newToken = data.token
    const userData = data.user
    localStorage.setItem('token', newToken)
    setToken(newToken)
    setUser(userData)
    return data
  }

  const register = async (formData) => {
    const data = await post('/auth/register', formData)
    const newToken = data.token
    const userData = data.user
    if (newToken) {
      localStorage.setItem('token', newToken)
      setToken(newToken)
      setUser(userData)
    }
    return data
  }

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  const updateProfile = async (profileData) => {
    // Backend exposes PUT /api/auth/me (see backend/src/routes/auth.js).
    // The old '/auth/profile' path 404'd on every save.
    const data = await put('/auth/me', profileData)
    setUser(data.user || data)
    return data
  }

  const isAuthenticated = !!token && !!user

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        updateProfile,
        isAuthenticated
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
