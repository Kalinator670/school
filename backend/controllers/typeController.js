const uuid = require('uuid');
const path = require('path');
const { Users, Contests, Rating, Tasks, ContestUser } = require('../models/models');
const ApiError = require('../error/ApiError');



class TypeController {

    async create(req, res, next) {

        let { name, description, userId, workers } = req.body;
        const {f} = req.files
        let fileName = uuid.v4() + path.parse(f.name).ext;
        f.mv(path.resolve(__dirname, '..', 'static', fileName))

        const isExists = await Contests.findOne({ where: { name } })

        if (isExists) {
            return next(ApiError.badRequest('Проект c таким именем уже существует'))
        }

        const contest = await Contests.create({ name, description, workers, fileName });
        const user = await Users.findAll({ where: { id: userId } });

        await contest.addUsers(user);
        return res.json(contest);  //Вместо ответа сделай на подобии ApiError только ApiSuccess.GoodRequest('Проект успешно создан')

    }


    async getAll(req, res) {


        let { limit, page } = req.query;
        page = page || 1;
        limit = limit || 8;
        let offset = page * limit - limit;
        const types = await Contests.findAndCountAll({
            limit: limit,
            offset: offset,
            distinct: true,
            include: [{
                model: Users,
                as: 'users',
                required: false,
                attributes: ['id', 'name', 'email'],
                through: { attributes: [] }

            }],
        });
        return res.json(types)
    }

    async add_user(req, res) {

        let { userId, contentId } = req.body;
        const user = await Users.findAll({ where: { id: userId } });
        const contest = await Contests.findOne({ where: { id: contentId } });

        if (user && contest) {

            await contest.addUsers(user);
            return res.json(contest) //Вместо ответа сделай на подобии ApiError только ApiSuccess.GoodRequest('Пользователь успешно добавлен')

        } else {

            return next(ApiError.badRequest('Такого пользователя или проекта не существует'))

        }
    }

    async createRate(req, res, next) {

        const { contestId, rate, userId } = req.body
        let rated;
        const contest = await Contests.findByPk(contestId)

        if (!contest) {
            throw new Error('Такого проекта не существует')
        }
        const user = await Users.findByPk(userId)
        if (!user) {
            throw new Error('Такого пользователя не существует')
        }
        const rating = await Rating.create({ userId: userId, contestsId: contestId, rate })
        const votes = await Rating.count({ where: { contestsId: contestId } })
        if (votes) {
            const rates = await Rating.sum('rate', { where: { contestsId: contestId } })
            rated = { rates, votes, rating: rates / votes }
            const updateContest = await Contests.update({ rating: rated }, {
                where: {
                    id: contestId
                }
            })
            res.json(updateContest)
        } else {
            rated = { rates: 0, votes: 0, rating: 0 }
            const updateContest = await Contests.update({ rating }, {
                where: {
                    id: contestId
                }
            })
            res.json(updateContest)
        }

    }

    async getUserProjects(req, res) {
        let { userId, page, limit } = req.query;
        page = page || 1;
        limit = limit || 8;
        let offset = page * limit - limit;

        // получаем пользователя
        const user = await Users.findOne({
            where: { id: userId }
        });

        if (!user) {

            throw new Error('Такого пользователя не существует');
        }
        const count = await user.countContests();
        const userContests = await user.getContests({
            limit: limit,
            offset: offset,
            distinct: true,
            include: [{

                model: Users,
                as: 'users',
                required: false,
                attributes: ['id', 'name', 'email'],
                through: { attributes: [] }

            }],
        });

        return res.json({
            count: count,
            rows: userContests
        });
    }


    async del_project(req, res) {
        const { id } = req.body;
        try {
            Contests.destroy({ where: { id: id } });
            ContestUser.destroy({ where: { contestsId: id } });
            Rating.destroy({ where: { contestsId: id } });
            res.json('Ok')
        } catch (error) {
            res.json(error)
        }
    }

    async del_user_project(req, res) {

        const { user_id } = req.body;
        try {
            ContestUser.destroy({ where: { userId: user_id } });
            Rating.destroy({ where: { userId: user_id } });
            res.json('Ok')
        } catch (error) {
            res.json(error)
        }
    }
}

module.exports = new TypeController()