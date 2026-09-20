import ApiService from '../../ApiService'

export default {
  login(data: object) {
    return ApiService.post(`login`, data)
  },
}
